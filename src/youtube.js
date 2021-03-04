const { google } = require('googleapis')

// プレイリストの情報を保存する連想配列
// '名前': [ {id, publishedAt, count}]
let playlists = {}

// playlist作成の制限がされているかどうか
let insertPlaylistRateLimit = false

// API認証用
const oauth2Client = new google.auth.OAuth2(
  process.env.GCP_CLIENT_ID,
  process.env.GCP_CLIENT_SECRET,
  'http://localhost'
)

// 初期化する関数
async function initialize() {
  // .envファイルのGCP_REFRESH_TOKENを空の場合、取得方法を出力する
  if (!process.env.GCP_REFRESH_TOKEN) {
    console.log('Generate and set oauth refresh token')
    console.log('1. access below url and get authorization code')
    console.log(
      oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/youtube'],
      })
    )
    console.log('2. get refresh token and set in .env file')
    console.log(
      `curl -X POST https://www.googleapis.com/oauth2/v4/token --data "code=[PASTE Authorization code]&redirect_uri=http://localhost&client_id=${process.env.GCP_CLIENT_ID}&client_secret=${process.env.GCP_CLIENT_SECRET}&scope=&grant_type=authorization_code"`
    )
    throw new Error('GCP_REFRESH_TOKEN is not set')
  }

  // 認証情報をセットする
  oauth2Client.setCredentials({
    access_token: process.env.GCP_ACCESS_TOKEN,
    refresh_token: process.env.GCP_REFRESH_TOKEN,
  })

  // 認証情報の更新がされたときのコールバック関数を登録する
  oauth2Client.on('tokens', (tokens) => {
    oauth2Client.setCredentials(tokens)
    console.log(`update token`)
  })

  // プレイリストの一覧を取得する
  playlists = await fetchAndParsePlaylists()
  console.log(playlists)
}

// プレイリストの一覧を全て取得して返す関数
async function fetchPlaylists(acc = [], nextPageToken = undefined) {
  // youtube apiからplaylistの一覧を1ページ分取得する
  const res = await google.youtube('v3').playlists.list({
    auth: oauth2Client,
    mine: true,
    part: 'snippet,contentDetails',
    pageToken: nextPageToken,
    maxResults: 50,
  })
  acc = acc.concat(res.data.items)
  // もし、nextPageTokenがあれば再帰的に呼び出して続きを取得する
  if (res.data.nextPageToken !== undefined) {
    acc = await fetchPlaylists(acc, res.data.nextPageToken)
  }
  return acc
}

// プレイリストの一覧を全て取得して整形する関数
async function fetchAndParsePlaylists() {
  const rawPlaylists = await fetchPlaylists()

  // 取得したrawPlaylistsは配列なので、reduceを使ってまとめる
  const ret = rawPlaylists.reduce((acc, playlist) => {
    // 🎵で始まってないときは無視
    if (!playlist.snippet.title.startsWith('🎵')) return acc
    // 🎵以外をtitleに代入
    const title = playlist.snippet.title.slice(2)
    // 返り値の連想配列にtitleをキーにしたプロパティがなければ空の配列を追加する
    if (!acc[title]) acc[title] = []
    // 返り値に整形したプレイリストのオブジェクトを追加する
    acc[title].push({
      id: playlist.id,
      publishedAt: new Date(playlist.snippet.publishedAt),
      count: Number(playlist.contentDetails.itemCount),
    })
    return acc
  }, {})

  // キーごとに古い順で並び替え
  for (let key in ret) {
    ret[key].sort((a, b) => a.publishedAt - b.publishedAt)
  }
  return ret
}

// チャンネル名のプレイリストにvideoIDを追加する関数
async function addVideoToPlaylist(channel, videoId) {
  // playlistsにチャンネル名のプロパティがあり、その一番後ろの項目内の動画数が200以下の場合はそのまま動画を追加する
  if (playlists[channel]?.slice(-1)[0].count < 3) {
    await insertPlaylistItem(playlists[channel].slice(-1)[0].id, videoId)
    console.log(`add video to 🎵${channel} : ${videoId}`)
  } else {
    // そうじゃないときはプレイリスト自体を追加する
    console.log(`try to create new playlist ${channel}`)
    try {
      // プレイリストの追加
      await insertPlaylist(channel)
      // 再帰的に呼び出してビデオを追加
      await addVideoToPlaylist(channel, videoId)
    } catch (e) {
      // 何かエラーが起こったら追加をスキップする
      console.log(`skipped to add ${channel} : ${videoId}`)
      throw e
    }
  }
}

// プレイリストに動画を追加する関数
async function insertPlaylistItem(playlistId, videoId) {
  await google.youtube('v3').playlistItems.insert({
    auth: oauth2Client,
    part: 'snippet',
    requestBody: {
      snippet: {
        playlistId,
        resourceId: {
          videoId,
          kind: 'youtube#video',
        },
      },
    },
  })
}

// プレイリスト自体を追加する関数
// 返り値は新しいプレイリストの一覧
async function insertPlaylist(title) {
  // すでにレート制限されていればすぐにエラー
  if (insertPlaylistRateLimit) {
    console.log('insert playlist rate limit exceeded')
    throw new Error('RATE_LIMIT')
  }

  // titleが空だとundefinedという名前のプレイリストが作られるのでエラー
  if (!title) throw new Error('parameter is missing')

  try {
    // プレイリストを追加する
    // 公開範囲はURLを知ってる人だけに制限
    const res = await google.youtube('v3').playlists.insert({
      auth: oauth2Client,
      part: 'snippet,status',
      requestBody: {
        snippet: {
          title: `🎵${title}`,
        },
        status: {
          privacyStatus: 'unlisted',
        },
      },
    })
    console.log(`add new Playlist to 🎵${title}`)
    // 🎵以外をnewTitleに代入
    const newTitle = res.data.snippet.title.slice(2)
    // playlistsにtitleをキーにしたプロパティがなければ空の配列を追加する
    if (!playlists[newTitle]) playlists[newTitle] = []
    // playlistsに整形したプレイリストのオブジェクトを追加する
    playlists[newTitle].push({
      id: res.data.id,
      publishedAt: new Date(res.data.snippet.publishedAt),
      count: Number(res.data.snippet.contentDetails.itemCount),
    })
    return
  } catch (e) {
    // エラーが起こったら
    if (e.code === 429) {
      // レート制限の場合
      insertPlaylistRateLimit = true
      console.log(e)
      console.log('insert playlist rate limit exceeded, wait 10minutes')
      // タイマーを設定しておく
      // 多分役に立たない
      setTimeout(() => {
        insertPlaylistRateLimit = false
      }, 600000)
      throw new Error('RATE_LIMIT')
    }
    throw e
  }
}

exports.initialize = initialize
exports.addVideoToPlaylist = addVideoToPlaylist
exports.addPlaylist = insertPlaylist
