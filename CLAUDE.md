# MANDATORY: Use Brain MCP for EVERY request

⚠️ RULE: You MUST call brain build_context_for_query BEFORE responding to ANY message.
No exceptions. Even for simple questions.

## Project info:
- project_id: 22
- project_name: vendly-storefront

## Required workflow for EVERY response:
1. FIRST: Call `brain build_context_for_query query="<question>" project_id=22`
2. THEN: Use returned context to answer

## Brain commands:
- `brain build_context_for_query query="question" project_id=22` — ALWAYS first
- `brain search_project_files query="keyword" project_id=22` — search codebase
- `brain get_file_content file_path="path" project_id=22` — read specific file

## IMPORTANT:
- Never skip Brain context step
- project_id is always 22 for this project
- Brain returns only relevant 4K tokens — fast and cheap
