if test -d ../../starlake-website/public/starlake; then
    BASE_URL=/starlake/ yarn build && \
    cd ../../starlake-website && \
    rm -rf ./public/starlake/* && \
    cp -fr ../public/starlake-docs/build/* ./public/starlake/
fi
