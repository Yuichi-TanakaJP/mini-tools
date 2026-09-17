# 2026-09-17 保有正本をPortfolioへ寄せる設計提案

## 背景

機能ポートフォリオ整理ではマイ銘柄のLocalStorage維持を推奨していたが、利用者からPortfolioの方が保有情報を多く持つとの指摘があった。通知の軽さと、保有事実の正本を同じ判断として扱っていたため、コードとstock-notes V2正本を再調査した。

## 今回決めたこと

調査結果と[連携設計提案](../plans/portfolio-holdings-authority-design.md)を残す。**設計提案の採用確認待ちであり、実装済み仕様や移行の承認ではない。**

- 取込済み保有の正本候補をPortfolio snapshot/positionとする。LocalStorage維持を保有全体の推奨結論として固定しない。
- ウォッチ・自由メモ、個別分析、Portfolio全体判断は分離する。
- 基準日・対象口座・失敗・未確認を表示し、未取込を非保有と推測しない。

## 判断理由

Portfolioには口座・数量・取得額・評価額・損益・履歴があり、V2正本も保有事実をsnapshot/positionに置いている。一方、通知は公開市場データを端末内で絞る方式を維持でき、保有の正本をLocalStorageに限定する必要はない。

ただし現行CSVは公式scopeのsnapshot置換で、空保有CSVはエラー、基準日未指定は取込時刻補完となる。またCSV取込が分析categoryをholdingへ昇格させる副作用がある。単純な取得元置換では不十分であり、共有契約と分類分離の確認を先行させる。

## 影響範囲

将来の対象はPortfolio、マイ銘柄、銘柄分析、ホーム通知、開示レーダーとstock-notes取込契約。今回はdocsのみで、データ、コード、認証、取込、同期、V2完成条件は変更しない。

## 残課題

提案の採用、Premium境界、口座網羅性と期待鮮度、共有契約とcategory互換を確認する。本番データ・実画面は未調査。旧データを削除しない参照元切替から始める。

## 関連

- [機能の所属と評価語](./2026-09-13-feature-portfolio-boundaries.md)
- [保有正本・連携設計](../plans/portfolio-holdings-authority-design.md)
- [現行Portfolio仕様](../specs/tools/portfolio.md)
