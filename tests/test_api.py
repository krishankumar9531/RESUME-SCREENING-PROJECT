"""Verification tests for HR auth, FastAPI backend routes, and ML screening engine."""

from __future__ import annotations

import asyncio
import io
import unittest
import uuid

from fastapi import HTTPException, Response, UploadFile

from backend.auth import (
    DEFAULT_HR_EMAIL,
    DEFAULT_HR_PASSWORD,
    init_auth_db,
    require_hr_user,
    verify_session_token,
)
from backend.main import (
    ExportRequest,
    JDParseRequest,
    LoginRequest,
    ModelPredictRequest,
    RegisterRequest,
    ScreenRequest,
    export_csv,
    health,
    load_demo_workspace,
    login,
    logout,
    model_info,
    parse_jd,
    parse_resumes,
    predict_single,
    register,
    screen_candidates,
)


class TestScreeningAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        init_auth_db()
        res = login(LoginRequest(email=DEFAULT_HR_EMAIL, password=DEFAULT_HR_PASSWORD), Response())
        cls.hr_user = res["user"]
        cls.token = res["token"]

    def test_auth_login_register_and_guard(self) -> None:
        with self.assertRaises(HTTPException) as ctx:
            require_hr_user(session_cookie=None, authorization=None)
        self.assertEqual(ctx.exception.status_code, 401)

        with self.assertRaises(HTTPException) as bad_login:
            login(LoginRequest(email=DEFAULT_HR_EMAIL, password="wrong-password"), Response())
        self.assertEqual(bad_login.exception.status_code, 401)

        verified = require_hr_user(session_cookie=self.token, authorization=None)
        self.assertEqual(verified["email"], DEFAULT_HR_EMAIL)
        self.assertIsNotNone(verify_session_token(self.token))

        unique_email = f"recruiter.{uuid.uuid4().hex[:8]}@talentlens.ai"
        reg_resp = register(
            RegisterRequest(
                name="Test Recruiter",
                email=unique_email,
                password="Password123!",
                role="Technical Recruiter",
            ),
            Response(),
        )
        self.assertEqual(reg_resp["user"]["email"], unique_email)
        self.assertIsNotNone(verify_session_token(reg_resp["token"]))

        out = logout(Response())
        self.assertEqual(out["status"], "logged_out")

    def test_health_and_model_info(self) -> None:
        h = health()
        self.assertEqual(h["status"], "ok")
        self.assertTrue(h["model_loaded"])

        info = model_info(self.hr_user)
        self.assertTrue(info["model_loaded"])
        self.assertIsNotNone(info["metrics"])
        self.assertGreater(len(info["importances"]), 0)

    def test_jd_parse_and_single_predict(self) -> None:
        jd_data = parse_jd(
            JDParseRequest(
                jd_text="Hiring Python Backend Engineer with 3+ years experience. "
                "Skills: Python, FastAPI, Docker, PostgreSQL. Bachelors degree."
            ),
            self.hr_user,
        )
        skill_ids = [s["id"] for s in jd_data["skills"]]
        self.assertIn("python", skill_ids)
        self.assertIn("fastapi", skill_ids)
        self.assertEqual(jd_data["experience"], 3)
        self.assertEqual(jd_data["education"], "Bachelors")

        pred = predict_single(
            ModelPredictRequest(
                years_experience=6,
                skills_match_score=90,
                education_level="Masters",
                project_count=8,
                resume_length=600,
                github_activity=350,
            ),
            self.hr_user,
        )
        self.assertGreaterEqual(pred["shortlist_probability"], 0.0)
        self.assertLessEqual(pred["shortlist_probability"], 1.0)

    def test_resume_upload_demo_screen_and_export(self) -> None:
        sample_txt = (
            b"Jane Doe\njane@example.com\n+1 555-234-5678\n"
            b"Experience\nJan 2020 - Present\nBuilt Python, FastAPI, Docker, PostgreSQL, and AWS services.\n"
            b"Education\nB.Tech in Computer Science\n"
            b"Projects\nCloud Resume Screener\n"
        )
        upload = UploadFile(filename="jane_doe.txt", file=io.BytesIO(sample_txt))
        parsed_res = asyncio.run(parse_resumes([upload], self.hr_user))
        self.assertEqual(len(parsed_res["parsed"]), 1)
        self.assertEqual(parsed_res["parsed"][0]["name"], "Jane Doe")

        demo_data = load_demo_workspace(self.hr_user)
        self.assertGreaterEqual(len(demo_data["parsed"]), 1)

        req_payload = {
            "skills": [s["id"] for s in demo_data["requirements"]["skills"]],
            "must": [],
            "exp": demo_data["requirements"]["exp"],
            "edu_rank": demo_data["requirements"]["edu_rank"],
        }
        screen_data = screen_candidates(
            ScreenRequest(candidates=demo_data["parsed"], requirements=req_payload),
            self.hr_user,
        )
        self.assertEqual(screen_data["summary"]["total"], len(demo_data["parsed"]))
        self.assertEqual(screen_data["candidates"][0]["rank"], 1)

        csv_resp = export_csv(
            ExportRequest(candidates=demo_data["parsed"], requirements=req_payload, shortlist_only=False),
            self.hr_user,
        )
        self.assertIn("Rank,Candidate,Status", csv_resp.body.decode("utf-8"))


if __name__ == "__main__":
    unittest.main()
