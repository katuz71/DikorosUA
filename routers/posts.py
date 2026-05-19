"""Post/blog routes."""

from __future__ import annotations

from fastapi import APIRouter, Body, HTTPException

from db import get_db_connection


router = APIRouter()


@router.post("/posts")
async def create_post(data: dict = Body(...)):
    conn = get_db_connection()
    try:
        conn.execute(
            "INSERT INTO posts (title, content, image_url) VALUES (?, ?, ?)",
            (data.get("title"), data.get("content"), data.get("image_url")),
        )
        conn.commit()
        return {"status": "success"}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}
    finally:
        conn.close()


@router.get("/api/posts")
@router.get("/api/post")
@router.get("/posts")
@router.get("/post")
def get_posts():
    conn = get_db_connection()
    posts = conn.execute("SELECT * FROM posts ORDER BY created_at DESC LIMIT 10").fetchall()
    conn.close()
    return [dict(post) for post in posts]


@router.get("/api/posts/{post_id}")
@router.get("/api/post/{post_id}")
@router.get("/posts/{post_id}")
@router.get("/post/{post_id}")
def get_post(post_id: int):
    conn = get_db_connection()
    post = conn.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
    conn.close()
    if not post:
        raise HTTPException(status_code=404, detail="Статья не найдена")
    return dict(post)


@router.delete("/posts/{post_id}")
async def delete_post(post_id: int):
    conn = get_db_connection()
    try:
        cursor = conn.execute("DELETE FROM posts WHERE id = ?", (post_id,))
        conn.commit()
        if cursor.rowcount == 0:
            return {"status": "error", "message": "Post not found"}
        return {"status": "success", "message": f"Post {post_id} deleted"}
    except Exception as exc:
        conn.rollback()
        return {"status": "error", "message": str(exc)}
    finally:
        conn.close()
