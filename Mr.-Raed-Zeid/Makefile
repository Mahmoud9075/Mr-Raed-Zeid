.PHONY: up down logs seed test backend frontend
up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f

test:
	cd backend && PYTHONPATH=. pytest -q

seed:
	cd backend && PYTHONPATH=. python -m app.seed

backend:
	cd backend && PYTHONPATH=. uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev
