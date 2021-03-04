require('dotenv').config()

const Discord = require('discord.js')
const Youtube = require('./youtube.js')

const discordClient = new Discord.Client()

// 監視するdiscordのチャンネルを保存する配列 {id, name}
let subscribedChannels = []

// discordに接続できたときのコールバック関数を登録する
discordClient.on('ready', async () => {
  console.log('start discord-youtube-playlist-bot')
  // bot招待用のURLを発行する
  console.log(
    await discordClient.generateInvite({
      permissions: [
        'SEND_MESSAGES',
        'EMBED_LINKS',
        'READ_MESSAGE_HISTORY',
        'ADD_REACTIONS',
      ],
    })
  )
})

// メッセージを受信したときのコールバック関数を登録する
discordClient.on('message', async (message) => {
  // 自分の発言かどうか
  if (message.author.id === discordClient.user.id) return
  // textチャンネルから送られているか
  if (message.channel.type !== 'text') return

  // コマンド
  // メンションの宛先に自分が含まれているかどうか
  if (message.mentions.has(discordClient.user)) {
    // メッセージの中身から' '(半角スペースの場所を探して)、それよりも後ろだけ抜き出したあと、前後の要らないものを消す
    switch (message.content.slice(message.content.indexOf(' ')).trim()) {
      case '!start':
        if (
          !subscribedChannels.some((channel) => {
            return (
              message.channel.name === channel.name &&
              message.channel.id === channel.id
            )
          })
        ) {
          subscribedChannels.push({
            name: message.channel.name,
            id: message.channel.id,
          })
          // こうするとメッセージにリアクションがつけられる
          // 便利！
          await message.react('🙋')
          console.log(
            `subscribed name:${message.channel.name}, id:${message.channel.id}`
          )
        } else {
          await message.react('🤔')
          console.log(
            `already subscribed name:${message.channel.name}, id:${message.channel.id} `
          )
        }
        break
      case '!stop':
        subscribedChannels = subscribedChannels.filter(
          (channel) => channel.id !== message.channel.id
        )
        await message.react('🤷‍♀️')
        console.log(
          `unsubscribed name:${message.channel.name}, id:${message.channel.id} `
        )
        break
      default:
        await message.react('😟')
        break
    }
  }

  // 監視しているチャンネルかどうか
  if (
    !subscribedChannels.some((channel) => channel.id === message.channel.id)
  ) {
    return
  }
  message.embeds.forEach(async (embed) => {
    // youtube videoが埋め込まれているかどうか
    if (
      embed.type === 'video' &&
      embed.url.startsWith('https://www.youtube.com/watch?v=')
    ) {
      // youtubeのビデオを見つけたのでvideoIdだけ取り出して
      const videoId = embed.url.slice('https://www.youtube.com/watch?v='.length)
      console.log(`found youtube video: ${videoId} in ${message.channel.name}`)
      try {
        // チャンネル名のプレイリストに追加する
        await Youtube.addVideoToPlaylist(message.channel.name, videoId)
        await message.react('🙆')
      } catch (e) {
        // 何かエラーの場合
        if (e.code === 429 || e.message === 'RATE_LIMIT') {
          // レート制限ならそのまま
          await message.react('🙅')
        } else {
          // それ以外なら強制終了
          await message.react('⚠️')
          process.exit(-1)
        }
      }
    }
  })
})

// main関数
// async/awaitが使いたいので関数にする
async function main() {
  try {
    // Youtube apiの初期化
    await Youtube.initialize()
    // Discord botをログインさせる
    await discordClient.login(process.env.DISCORD_BOT_TOKEN)
  } catch (e) {
    // youtube初期化エラー・discordログインエラーは問答無用で強制終了
    console.error(e)
    process.exit(-1)
  }

  // テスト用
  // try {
  //   await Youtube.addVideoToPlaylist('リスト', '4-BVYLmQNV8')
  // } catch (e) {
  //   console.error(e)
  //   if (e.code !== 429 && e.message !== 'RATE_LIMIT') process.exit(-1)
  // }
}

// main関数を実行
main()
