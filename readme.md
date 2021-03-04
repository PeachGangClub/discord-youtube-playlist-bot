# Discord youtube playlist bot
指定したチャンネル内のyoutube動画のURLをプレイリストにまとめるBOT

## 使い方

1.実行するとサーバー側にBOT招待用のURLが発行されるのでしかるべき権限を持った人が招待する

2.チャンネルに呼ぶにはメンション+コマンドが必要

コマンド
|コマンド|効果                 |
|-------|---------------------|
|!start |チャンネルを監視する   |
|!stop  |チャンネルの監視をやめる|


## インストールする
```
$ npm install
```
.envというファイルを作って、中身を以下のように作る
```
DISCORD_BOT_TOKEN = (Discord BOT用のトークン)
GCP_CLIENT_ID = (youtube apiを使用するのに必要)
GCP_CLIENT_SECRET = (youtube apiを使用するのに必要)
GCP_ACCESS_TOKEN = (youtube apiを使用するのに必要)
GCP_REFRESH_TOKEN = (youtube apiを使用するのに必要)
```

## 実行する
```
$ npm run start
or
$ npm run start-watch
```

start-watchだと変更を監視して再実行してくれる