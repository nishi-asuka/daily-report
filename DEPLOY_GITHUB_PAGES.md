# GitHub Pages 公開手順

このアプリを自分のスマホでPWAとして使うには、HTTPSのURLで開く必要があります。GitHub Pagesを使う場合の手順です。

## 重要な前提

- 公開されるのはアプリ本体のHTML/CSS/JavaScriptです。
- 登録した予定データはスマホのブラウザ内に保存されます。
- 予定内容はGitHubには送信されません。
- リポジトリをpublicにすると、アプリ本体のコードは誰でも見られます。

## 1. GitHubでリポジトリを作成

GitHubで新しいリポジトリを作成します。

推奨名:

```text
personal-schedule-pwa
```

設定:

- Visibility: `Public`
- README: 追加しない
- .gitignore: 追加しない
- License: 追加しない

## 2. このフォルダからGitHubへpush

GitHubの画面に表示される `owner/repo` に合わせて、下のURLを置き換えて実行します。

簡単に実行する場合:

```powershell
.\publish_to_github_pages.ps1 -RepositoryUrl "https://github.com/YOUR_NAME/personal-schedule-pwa.git"
```

手動で実行する場合:

```powershell
git remote add origin https://github.com/YOUR_NAME/personal-schedule-pwa.git
git branch -M main
git push -u origin main
```

## 3. GitHub Pagesを有効化

GitHubのリポジトリ画面で:

1. `Settings`
2. `Pages`
3. `Build and deployment`
4. Source を `Deploy from a branch`
5. Branch を `main`、Folder を `/ (root)`
6. `Save`

数分後、次のようなURLが発行されます。

```text
https://YOUR_NAME.github.io/personal-schedule-pwa/
```

## 4. スマホのホーム画面に追加

iPhone:

1. SafariでGitHub PagesのURLを開く
2. 共有ボタン
3. `ホーム画面に追加`

Android:

1. ChromeでGitHub PagesのURLを開く
2. メニュー
3. `アプリをインストール` または `ホーム画面に追加`

## 5. バックアップ

予定データは端末内保存です。機種変更やブラウザ削除に備えて、定期的にアプリ内の `JSON` ボタンでバックアップしてください。
