-- Migration: create_profiles_table
-- Created at: 1754736708

-- إنشاء جدول المستخدمين (الأساتذة والطلاب)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('teacher', 'student')),
    phone VARCHAR(20),
    avatar_url TEXT,
    bio TEXT,
    expertise TEXT[],
    is_banned BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);;