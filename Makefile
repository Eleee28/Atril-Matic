WASM_DIR=frontend/wasm
RUST_DIR=audio-processor

dev: wasm up

wasm:
	cd $(RUST_DIR) && wasm-pack build --target web --out-dir ../$(WASM_DIR) --out-name audio_processor

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

.PHONY: wasm test check clean up down dev
