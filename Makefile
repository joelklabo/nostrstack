PNPM=pnpm
REPO=joelklabo/nostrstack

.PHONY: deps deps-prod build lint test typecheck check dev-api dev-gallery dev-demo e2e deploy-staging deploy-prod

deps:
	$(PNPM) install

deps-prod:
	NODE_ENV=production $(PNPM) install --frozen-lockfile --prod

build:
	$(PNPM) -r build

lint:
	$(PNPM) lint

test:
	$(PNPM) test

typecheck:
	$(PNPM) typecheck

check: lint test typecheck

dev-api:
	$(PNPM) --filter api dev

dev-gallery:
	$(PNPM) --filter gallery dev -- --host --port 4173

dev-demo:
	./scripts/dev-demo.sh

e2e:
	$(PNPM) --filter api test:e2e

deploy-staging:
	gh workflow run azure-deploy-staging.yml --repo $(REPO)

deploy-prod:
	gh workflow run azure-deploy.yml --repo $(REPO)
