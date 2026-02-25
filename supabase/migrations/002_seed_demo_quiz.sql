-- ============================================================
-- RubicSage – Demo seed data
-- Run AFTER 001_initial_schema.sql
-- Creates a placeholder super_admin profile + demo quizzes.
-- Replace 'demo-admin-uuid' with an actual auth user ID after setup.
-- ============================================================

-- NOTE: This file seeds quiz metadata only.
-- To add quiz content (questions), use the Admin panel (/admin/quizzes)
-- and paste the JSON from quiz-engine/data/quizzes/*.json into the version editor.

-- Insert demo quiz stubs (no auth user yet, created_by left null)
INSERT INTO public.quizzes (id, subject, title, description, status)
VALUES
  (
    'b3f1a2c0-0001-0001-0001-000000000001',
    'polish',
    'Matura 2025 – Język Polski (Podstawowy) Demo',
    'Demonstracyjny zestaw zadań z języka polskiego na poziomie podstawowym.',
    'draft'
  ),
  (
    'b3f1a2c0-0002-0002-0002-000000000002',
    'math',
    'Matura 2025 – Matematyka (Podstawowy) Demo',
    'Demonstracyjny zestaw zadań z matematyki na poziomie podstawowym.',
    'draft'
  ),
  (
    'b3f1a2c0-0003-0003-0003-000000000003',
    'informatics',
    'Matura 2025 – Informatyka (Rozszerzony) Demo',
    'Demonstracyjny zestaw zadań z informatyki na poziomie rozszerzonym.',
    'draft'
  )
ON CONFLICT (id) DO NOTHING;
