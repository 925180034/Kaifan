#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from server.analytics import load_event_rows, summarize_events


def main():
    parser = argparse.ArgumentParser(description="Summarize Kaifan event_log product metrics.")
    parser.add_argument("--db", default="data/kaifan.sqlite", help="SQLite database path. Default: data/kaifan.sqlite")
    parser.add_argument("--json", action="store_true", help="Print raw JSON summary")
    args = parser.parse_args()

    summary = summarize_events(load_event_rows(args.db))
    if args.json:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return

    print(format_summary(summary, args.db))


def format_summary(summary, db_path):
    rates = summary["rates"]
    decision = summary["decision"]
    refresh = summary["refresh"]
    platform = summary["platformLinks"]
    funnel = summary["funnel"]

    lines = [
        "Kaifan 产品数据报告",
        f"数据库: {db_path}",
        f"总事件: {summary['totalEvents']} | 用户数: {summary['uniqueUsers']}",
        "",
        "漏斗",
        f"- 打开: {funnel['app_opened']}",
        f"- 问卷开始/完成: {funnel['onboarding_started']} / {funnel['onboarding_completed']} ({fmt_rate(rates['onboardingCompletionRate'])})",
        f"- 生成/采纳: {funnel['decision_generated']} / {funnel['card_selected']} ({fmt_rate(rates['adoptionRate'])})",
        f"- 履约完成: {funnel['fulfillment_completed']} ({fmt_rate(rates['fulfillmentCompletionRate'])})",
        f"- 反馈: {funnel['feedback_submitted']} ({fmt_rate(rates['feedbackRate'])})",
        "",
        "效率",
        f"- 中位生成耗时: {fmt_seconds(decision['medianDecisionDurationSeconds'])}",
        f"- 平均换一批次数: {fmt_number(refresh['averageRefreshesPerDecision'])}",
        "",
        "平台链接",
        f"- 点击/复制: {platform['count']}",
        f"- fallback 次数: {platform['fallbackCount']}",
        f"- 平台分布: {json.dumps(platform['platforms'], ensure_ascii=False)}",
        f"- 状态分布: {json.dumps(platform['statuses'], ensure_ascii=False)}",
    ]
    return "\n".join(lines)


def fmt_rate(value):
    return "-" if value is None else f"{value * 100:.1f}%"


def fmt_seconds(value):
    return "-" if value is None else f"{value:.1f}s"


def fmt_number(value):
    return "-" if value is None else f"{value:.2f}"


if __name__ == "__main__":
    main()
