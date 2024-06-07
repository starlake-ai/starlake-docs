if test -d ../../starlake-ui2/public/starlake; then
    BASE_URL=/starlake/ yarn build && \
    cd ../../starlake-ui2 && \
    rm -rf ./public/starlake/* && \
    cp -fr ../public/starlake-docs/build/* ./public/starlake/
fi
