FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.12.8 /uv /bin/uv

WORKDIR /srv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PROJECT_ENVIRONMENT=/srv/.venv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY alembic.ini ./
COPY migrations ./migrations
COPY app ./app

ENV PATH="/srv/.venv/bin:$PATH" FORWARDED_ALLOW_IPS="127.0.0.1"
EXPOSE 8000
USER nobody
CMD ["sh", "-c", "uvicorn app.main:create_app --factory --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips \"$FORWARDED_ALLOW_IPS\""]
