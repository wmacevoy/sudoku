FROM node:20-alpine

WORKDIR /usr/src/app

# Pin Chromium + Chromedriver to a matching known-good version to keep Selenium stable.
ARG CHROMIUM_VERSION=142.0.7444.59-r0
RUN apk add --no-cache \
    "chromium=${CHROMIUM_VERSION}" \
    "chromium-chromedriver=${CHROMIUM_VERSION}" \
    nss

# Make the chromium/chromedriver paths explicit for tools that consult env vars.
ENV CHROME_BIN=/usr/bin/chromium-browser \
    CHROMEDRIVER_PATH=/usr/bin/chromedriver

COPY package.json ./
RUN npm install --ignore-scripts --no-audit --no-fund

COPY . .

CMD ["npm", "test"]
