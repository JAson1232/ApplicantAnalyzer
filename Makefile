COMPOSE := docker compose --env-file .env

.PHONY: up down logs seed ps

up:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f --tail=200

seed:
	$(COMPOSE) exec -T backend npm run seed

ps:
	$(COMPOSE) ps
