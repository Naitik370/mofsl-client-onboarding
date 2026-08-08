from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

import services


@asynccontextmanager
async def lifespan(_: FastAPI):
    services.init_db()
    yield


app = FastAPI(title="MOFSL Client Onboarding API", lifespan=lifespan)


@app.exception_handler(HTTPException)
async def http_error(_: Request, exc: HTTPException):
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code)


def require_user(request: Request) -> dict:
    user = services.session_user(request.cookies.get("session", ""))
    if not user:
        raise HTTPException(401, "Authentication required")
    return user


def require_admin(user: dict = Depends(require_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(403, "Admin access required")
    return user


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/auth/login")
def login(payload: dict, response: Response):
    result = services.authenticate(
        str(payload.get("username", "")),
        str(payload.get("password", "")),
    )
    if not result:
        raise HTTPException(401, "Invalid username or password")
    token = result.pop("token")
    response.set_cookie("session", token, max_age=43200, httponly=True, samesite="strict")
    return result


@app.get("/api/auth/me")
def me(user: dict = Depends(require_user)):
    return user


@app.post("/api/auth/logout")
def logout(request: Request, response: Response, _: dict = Depends(require_user)):
    services.logout(request.cookies.get("session", ""))
    response.delete_cookie("session", httponly=True, samesite="strict")
    return {"status": "ok"}


@app.get("/api/meta")
def meta(_: dict = Depends(require_user)):
    return services.get_meta()


@app.get("/api/cases")
def cases(user: dict = Depends(require_user)):
    return services.get_cases(user)


@app.post("/api/cases")
def create_case(payload: dict, user: dict = Depends(require_user)):
    status, body = services.save_case(payload, user=user)
    return JSONResponse(body, status_code=int(status))


@app.put("/api/cases/{entry_id}")
def update_case(entry_id: int, payload: dict, user: dict = Depends(require_user)):
    status, body = services.save_case(payload, entry_id, user)
    return JSONResponse(body, status_code=int(status))


@app.get("/api/users")
def users(_: dict = Depends(require_admin)):
    return services.get_users()


@app.post("/api/users")
def create_user(payload: dict, _: dict = Depends(require_admin)):
    status, body = services.add_user(payload)
    return JSONResponse(body, status_code=int(status))


@app.get("/api/history")
def history(user: dict = Depends(require_user)):
    return services.get_history(user)


@app.get("/api/reports")
def reports(
    start: str = "",
    end: str = "",
    dimension: str = "cseName",
    user: dict = Depends(require_user),
):
    return services.report(start, end, dimension, user)


app.mount("/", StaticFiles(directory=services.FRONTEND_ROOT, html=True), name="frontend")
