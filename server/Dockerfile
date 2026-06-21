# syntax=docker/dockerfile:1

ARG UNSTRUCTURED_IMAGE=downloads.unstructured.io/unstructured-io/unstructured:latest
FROM ${UNSTRUCTURED_IMAGE}

USER root

RUN mkdir -p /workspace \
    && chown -R notebook-user:notebook-user /workspace

WORKDIR /workspace

COPY --chown=notebook-user:notebook-user requirements.txt /tmp/requirements.txt

USER notebook-user

RUN uv pip install \
      --python /app/.venv/bin/python \
      --requirements /tmp/requirements.txt

ENV PATH="/app/.venv/bin:${PATH}" \
    PYTHONPATH="/workspace" \
    PYTHONDONTWRITEBYTECODE="1" \
    PYTHONUNBUFFERED="1" \
    DO_NOT_TRACK="true"

COPY --chown=notebook-user:notebook-user . /workspace

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
