/**
 * e-Stat アプリケーションID 取得案内 定数
 *
 * URL や手順が変更された場合はこのファイルのみ更新する。
 * 最終確認日: ESTAT_GUIDE_LAST_VERIFIED を参照。
 */

export const ESTAT_URLS = {
  /** e-Stat ユーザー登録・ログインページ */
  registration: "https://www.e-stat.go.jp/mypage/login",
  /** e-Stat API トップページ */
  apiTop: "https://api.e-stat.go.jp/",
} as const;

export interface EStatGuideStep {
  step: number;
  text: string;
}

export const ESTAT_GUIDE_STEPS: readonly EStatGuideStep[] = [
  { step: 1, text: "e-Stat のサイトでユーザー登録をする" },
  { step: 2, text: "ログイン後、マイページから「API 機能」を申請する" },
  { step: 3, text: "申請が承認されるとアプリケーションID が発行される" },
  { step: 4, text: "発行された ID をコピーして上の入力欄に貼り付ける" },
] as const;

/** 手順の最終確認日（e-Stat 公式サイトの仕様変更時に更新する） */
export const ESTAT_GUIDE_LAST_VERIFIED = "2026-04-02";
