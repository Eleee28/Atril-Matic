WASM_DIR=wasm
RUST_DIR=audio-processor
BACKEND_DIR=backend

dev: wasm up backend

wasm:
	cd $(RUST_DIR) && \
	wasm-pack build --target web --out-dir ../$(WASM_DIR) --out-name audio_processor && \
	wasm-pack build --target nodejs --out-dir ../$(WASM_DIR)-node --out-name audio_processor

test:
	cd $(RUST_DIR) && cargo test --locked

check:
	cd $(RUST_DIR) && cargo check

clean:
	cd $(RUST_DIR) && cargo clean
	rm -rf $(WASM_DIR)

up:
	docker compose up -d

down:
	docker compose down

backend:
	cd $(BACKEND_DIR) && npm run dev

.PHONY: wasm test check clean up down dev backend
