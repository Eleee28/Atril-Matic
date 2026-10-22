# Atril-Matic

## About the project

### Status

## Dependencies

- Install rust and cargo: [guide](https://oneuptime.com/blog/post/2026-01-15-install-rust-cargo-ubuntu/view)

- Run: `cargo install wasm-pack`

## How to run

There is a Makefile, run the following:

- Compile wasm and spin up Docker: `make dev`

- Build wasm: `make wasm`

- Test with cargo: `make test`

- Cargo check: `make check`

- Clean cargo and wasm: `make clean`

- Spin up Docker containers: `make up`

- Stop and remove containers: `make down`

## Debugging and logs

~~~rust
error!("Something failed");
warn!("Unexpected value");
info!("Track loaded");
debug!("Detected frequency: {}", frequency);
~~~

## License