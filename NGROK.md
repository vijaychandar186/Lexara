# ngrok Setup

## Install

```bash
curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc \
  | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null \
  && echo "deb https://ngrok-agent.s3.amazonaws.com bookworm main" \
  | sudo tee /etc/apt/sources.list.d/ngrok.list \
  && sudo apt update \
  && sudo apt install ngrok
```

## Auth

```bash
ngrok config add-authtoken <YOUR_NGROK_AUTHTOKEN>
```

> Get your token from [dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken)

## Run

```bash
ngrok http 3000
```

Your dev domain will be shown in the terminal output, e.g.:

```
https://<your-subdomain>.ngrok-free.dev
```
