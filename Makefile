WASM_DIR=wasm
RUST_DIR=audio-processor
BACKEND_DIR=backend

dev: wasm up backend

dev-log: wasm-logs up backend

wasm:
	cd $(RUST_DIR) && \
	wasm-pack build --target web --out-dir ../$(WASM_DIR) --out-name audio_processor && \
	wasm-pack build --target nodejs --out-dir ../$(WASM_DIR)-node --out-name audio_processor

wasm-logs:
	cd $(RUST_DIR) && \
	wasm-pack build --target web --out-dir ../$(WASM_DIR) --out-name audio_processor -- --features debug-logs && \
	wasm-pack build --target nodejs --out-dir ../$(WASM_DIR)-node --out-name audio_processor -- --features debug-logs

test:
	cd $(RUST_DIR) && cargo test --locked

test-debug:
	cd $(RUST_DIR) && RUST_LOG=debug cargo test --locked

test-file: 
	cd $(RUST_DIR) && RUST_LOG=debug cargo test --locked > debug.log 2>&1

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
