FROM python:3.12-slim
WORKDIR /app

COPY apps/api/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/api/app.py ./app.py
COPY apps/api/auth.py ./auth.py
COPY apps/api/github_adapter.py ./github_adapter.py
COPY apps/api/monitor.py ./monitor.py
EXPOSE 5000
CMD ["sh", "-c", "flask --app app init-db && flask --app app run --host=0.0.0.0 --port=5000"]
