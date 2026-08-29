"use client";

import { useState } from "react";
import styles from "../CompanyNetwork.module.css";
import type {
  CompanyFunctionLink,
  CompanyNetworkCompany,
  CompanyNetworkNodeSelection,
  CompanyRelationship,
} from "../types";
import FunctionRelationRadialView from "./FunctionRelationRadialView";
import NetworkView from "./NetworkView";

type RelationMode = "capital" | "function";

type Props = {
  groupName: string;
  companies: CompanyNetworkCompany[];
  relationships: CompanyRelationship[];
  functions: CompanyFunctionLink[];
  selection: CompanyNetworkNodeSelection | null;
  selectedRelationId: string | null;
  focusCompanyId: string;
  query: string;
  onSelectCompany: (companyId: string) => void;
  onSelectGroup: (groupId: string) => void;
  onSelectRelation: (relationId: string | null) => void;
};

export default function RelationshipModesView({
  groupName,
  companies,
  relationships,
  functions,
  selection,
  selectedRelationId,
  focusCompanyId,
  query,
  onSelectCompany,
  onSelectGroup,
  onSelectRelation,
}: Props) {
  const [mode, setMode] = useState<RelationMode>("capital");

  return (
    <div className={styles.viewFade}>
      <div
        className={styles.filterRow}
        role="tablist"
        aria-label="関係の種類"
        style={{ marginBottom: 8 }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "capital"}
          className={`${styles.toggle} ${mode === "capital" ? styles.toggleOn : ""}`}
          onClick={() => setMode("capital")}
        >
          資本関係
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "function"}
          className={`${styles.toggle} ${mode === "function" ? styles.toggleOn : ""}`}
          onClick={() => setMode("function")}
        >
          事業・機能
        </button>
      </div>

      {mode === "capital" ? (
        relationships.length === 0 ? (
          <p className={styles.empty}>
            <strong>{groupName}</strong>の企業間relationは現在未登録です。事業・機能モードでは登録済みtaxonomyを確認できます。
          </p>
        ) : (
          <NetworkView
            title={`${groupName}の企業間関係`}
            companies={companies}
            relationships={relationships}
            memberships={[]}
            centerCompanyId=""
            selection={selection}
            selectedRelationId={selectedRelationId}
            query={query}
            onSelectCompany={onSelectCompany}
            onSelectGroup={onSelectGroup}
            onSelectRelation={onSelectRelation}
          />
        )
      ) : (
        <FunctionRelationRadialView
          groupName={groupName}
          companies={companies}
          functions={functions}
          selection={selection}
          focusCompanyId={focusCompanyId}
          query={query}
          onSelectCompany={onSelectCompany}
        />
      )}
    </div>
  );
}
