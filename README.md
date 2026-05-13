# Personal Schedule App

個人用のスケジュール管理プロトタイプです。外部サービスには接続せず、予定はブラウザの `localStorage` に保存します。

## できること

- PWA対応。スマホのホーム画面に追加してアプリ風に起動
- HTTPS配信時のオフラインキャッシュ
- 月表示カレンダー
- 予定の追加、編集、削除
- 終日予定と時間指定予定
- 担当者、カテゴリ、ステータス、重要度、場所、メモ
- 同日・同時間帯の重複警告
- 件名、担当者、場所、メモの検索
- 日本語メモからの日付・時刻・件名の簡易抽出
- JSON / CSV エクスポート
- JSON インポート

## 起動

依存を追加せずに確認する場合は、`index.html` をブラウザで開けます。

ローカルサーバーで確認する場合:

```powershell
npm.cmd run start
```

## 携帯アプリとして使う場合

このアプリはPWAとして作っています。スマホのホーム画面に追加するには、`file://` ではなくHTTPSのURLで開く必要があります。

- iPhone: SafariでURLを開き、共有ボタンから「ホーム画面に追加」
- Android: ChromeでURLを開き、メニューから「アプリをインストール」または「ホーム画面に追加」

予定データは端末内のブラウザ保存領域に保存されます。端末変更やブラウザ削除に備える場合は、JSONエクスポートでバックアップしてください。

GitHub PagesでHTTPS公開する手順は [DEPLOY_GITHUB_PAGES.md](./DEPLOY_GITHUB_PAGES.md) を見てください。

構文チェック:

```powershell
npm.cmd run check
```

## 今後の拡張候補

- Google Calendar 連携
- ChatGPT Apps SDK の MCP ツール化
- 週表示、日表示
- 繰り返し予定
- 共有メンバー、担当者、店舗/拠点の概念
- SQLite や Google Sheets などへの保存先拡張
