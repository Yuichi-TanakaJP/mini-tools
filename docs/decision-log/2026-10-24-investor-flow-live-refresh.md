# 投資部門別の公開更新を開いた画面へ届ける

Cloud primary移行に合わせ、APIは可変4種を30秒で再検証し、mini-toolsはvisible時60秒/復帰時に本文を確認する。serverは選択肢を直近12/13週へ絞り、背景の全履歴転送を避ける。履歴queryを固定し、document reloadやrouter.refreshの繰り返しでUI状態を失わせない。部分公開・時刻逆行・失敗時は前の表示を保持する。

構成とDB方針の根拠はworkspace-core `docs/investor-flow-cloud-architecture-20261024.md`。APIは取得・分析・公開・排他を引き受けない。本番反映と実データの新週到達はdraft PRのコード検証とは分ける。
