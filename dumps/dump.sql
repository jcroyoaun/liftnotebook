--
-- PostgreSQL database dump
--

-- Dumped from database version 16.8
-- Dumped by pg_dump version 17.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Drop existing objects in reverse order of creation
ALTER TABLE IF EXISTS ONLY public.exercises DROP CONSTRAINT IF EXISTS exercises_movement_pattern_id_fkey;
ALTER TABLE IF EXISTS ONLY public.exercise_muscles DROP CONSTRAINT IF EXISTS exercise_muscles_muscle_id_fkey;
ALTER TABLE IF EXISTS ONLY public.exercise_muscles DROP CONSTRAINT IF EXISTS exercise_muscles_exercise_id_fkey;
DROP INDEX IF EXISTS public.idx_exercises_movement_pattern_id;
DROP INDEX IF EXISTS public.idx_exercise_muscles_muscle_id;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE IF EXISTS ONLY public.muscles DROP CONSTRAINT IF EXISTS muscles_pkey;
ALTER TABLE IF EXISTS ONLY public.muscles DROP CONSTRAINT IF EXISTS muscles_name_key;
ALTER TABLE IF EXISTS ONLY public.movement_patterns DROP CONSTRAINT IF EXISTS movement_patterns_pkey;
ALTER TABLE IF EXISTS ONLY public.exercises DROP CONSTRAINT IF EXISTS exercises_pkey;
ALTER TABLE IF EXISTS ONLY public.exercise_muscles DROP CONSTRAINT IF EXISTS exercise_muscles_pkey;
ALTER TABLE IF EXISTS public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.muscles ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.movement_patterns ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.exercises ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.users_id_seq;
DROP TABLE IF EXISTS public.users;
DROP SEQUENCE IF EXISTS public.muscles_id_seq;
DROP TABLE IF EXISTS public.muscles;
DROP SEQUENCE IF EXISTS public.movement_patterns_id_seq;
DROP TABLE IF EXISTS public.movement_patterns;
DROP SEQUENCE IF EXISTS public.exercises_id_seq;
DROP TABLE IF EXISTS public.exercises;
DROP TABLE IF EXISTS public.exercise_muscles;
DROP TYPE IF EXISTS public.target_type_enum;
DROP TYPE IF EXISTS public.exercise_type_enum;
DROP TYPE IF EXISTS public.body_part_enum;
DROP EXTENSION IF EXISTS citext;

--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;

--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: -
--
COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';

--
-- Name: body_part_enum; Type: TYPE; Schema: public; Owner: -
--
CREATE TYPE public.body_part_enum AS ENUM (
    'chest',
    'back',
    'shoulders',
    'biceps',
    'triceps',
    'quadriceps',
    'hamstrings',
    'glutes',
    'calves',
    'core',
    'forearms',
    'traps'
);

--
-- Name: exercise_type_enum; Type: TYPE; Schema: public; Owner: -
--
CREATE TYPE public.exercise_type_enum AS ENUM (
    'compound',
    'isolation'
);

--
-- Name: target_type_enum; Type: TYPE; Schema: public; Owner: -
--
CREATE TYPE public.target_type_enum AS ENUM (
    'primary',
    'secondary'
);

SET default_tablespace = '';
SET default_table_access_method = heap;

--
-- Name: exercises; Type: TABLE; Schema: public; Owner: -
--
CREATE TABLE public.exercises (
    id bigint NOT NULL,
    created_at timestamp(0) with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    type public.exercise_type_enum NOT NULL,
    movement_pattern_id bigint NOT NULL,
    version integer DEFAULT 1 NOT NULL
);

--
-- Name: exercises_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--
CREATE SEQUENCE public.exercises_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.exercises_id_seq OWNED BY public.exercises.id;

--
-- Name: movement_patterns; Type: TABLE; Schema: public; Owner: -
--
CREATE TABLE public.movement_patterns (
    id bigint NOT NULL,
    created_at timestamp(0) with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    description text,
    version integer DEFAULT 1 NOT NULL
);

--
-- Name: movement_patterns_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--
CREATE SEQUENCE public.movement_patterns_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.movement_patterns_id_seq OWNED BY public.movement_patterns.id;

--
-- Name: muscles; Type: TABLE; Schema: public; Owner: -
--
CREATE TABLE public.muscles (
    id bigint NOT NULL,
    created_at timestamp(0) with time zone DEFAULT now() NOT NULL,
    name character varying(100) NOT NULL,
    body_part public.body_part_enum NOT NULL,
    version integer DEFAULT 1 NOT NULL
);

--
-- Name: muscles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--
CREATE SEQUENCE public.muscles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.muscles_id_seq OWNED BY public.muscles.id;

--
-- Name: exercise_muscles; Type: TABLE; Schema: public; Owner: -
--
CREATE TABLE public.exercise_muscles (
    exercise_id bigint NOT NULL,
    muscle_id bigint NOT NULL,
    created_at timestamp(0) with time zone DEFAULT now() NOT NULL,
    target_type public.target_type_enum NOT NULL,
    version integer DEFAULT 1 NOT NULL
);

--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--
CREATE TABLE public.users (
    id bigint NOT NULL,
    created_at timestamp(0) with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    email public.citext NOT NULL,
    password_hash bytea NOT NULL,
    activated boolean NOT NULL,
    version integer DEFAULT 1 NOT NULL
);

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--
CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

--
-- Name: exercises id; Type: DEFAULT; Schema: public; Owner: -
--
ALTER TABLE ONLY public.exercises ALTER COLUMN id SET DEFAULT nextval('public.exercises_id_seq'::regclass);

--
-- Name: movement_patterns id; Type: DEFAULT; Schema: public; Owner: -
--
ALTER TABLE ONLY public.movement_patterns ALTER COLUMN id SET DEFAULT nextval('public.movement_patterns_id_seq'::regclass);

--
-- Name: muscles id; Type: DEFAULT; Schema: public; Owner: -
--
ALTER TABLE ONLY public.muscles ALTER COLUMN id SET DEFAULT nextval('public.muscles_id_seq'::regclass);

--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--
ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

--
-- Data for Name: movement_patterns; Type: TABLE DATA; Schema: public; Owner: -
--
COPY public.movement_patterns (id, created_at, name, description, version) FROM stdin;
1	2025-07-13 01:57:43+00	Squat	Free weight Hip and knee flexion movement pattern performed with a barbell resting on the upper body	1
2	2025-07-13 01:57:43+00	Leg Press	Machine knee flexion movements pattern	1
3	2025-07-13 01:57:43+00	Deadlift	Free weight barbell loaded Hip flexion dominant movement pattern	1
4	2025-07-13 01:57:43+00	Hip Hinge	Hip flexion dominant movement pattern	1
6	2025-07-13 01:57:43+00	Vertical Pull	Pulling motion in vertical plane	1
7	2025-07-13 01:57:43+00	Vertical Push	Pushing motion in vertical plane	1
8	2025-07-13 01:57:43+00	Horizontal Pull	Pulling motion in horizontal plane	1
9	2025-07-13 01:57:43+00	Horizontal Push	Pushing motion in horizontal plane	1
10	2025-07-13 01:57:43+00	Horizontal Hip Extension	Hip extension in horizontal plane	1
11	2025-07-13 01:57:43+00	Pull Over	Arc motion bringing arms overhead	1
12	2025-07-13 01:57:43+00	Fly	Arc motion in horizontal plane	1
13	2025-07-13 01:57:43+00	Dips	Free weight dips performed on parallel bars	1
14	2025-07-13 01:57:43+00	Isolation	Single joint movement pattern	1
15	2025-07-13 01:57:43+00	Grip work	Movements aimed to improve forearm and grip strength	1
16	2025-07-13 01:57:43+00	Shrugs	Single joint movement pattern	1
17	2025-07-13 01:57:43+00	Unilateral Leg Movement	Single leg focused movement patterns	1
\.

--
-- Data for Name: muscles; Type: TABLE DATA; Schema: public; Owner: -
--
COPY public.muscles (id, created_at, name, body_part, version) FROM stdin;
1	2025-07-13 01:57:43+00	Pectoralis Major	chest	1
2	2025-07-13 01:57:43+00	Pectoralis Minor	chest	1
3	2025-07-13 01:57:43+00	Latissimus Dorsi	back	1
4	2025-07-13 01:57:43+00	Rhomboids	back	1
5	2025-07-13 01:57:43+00	Middle Trapezius	traps	1
6	2025-07-13 01:57:43+00	Lower Trapezius	traps	1
7	2025-07-13 01:57:43+00	Erector Spinae	back	1
8	2025-07-13 01:57:43+00	Anterior Deltoid	shoulders	1
9	2025-07-13 01:57:43+00	Middle Deltoid	shoulders	1
10	2025-07-13 01:57:43+00	Posterior Deltoid	shoulders	1
11	2025-07-13 01:57:43+00	Biceps Brachii	biceps	1
12	2025-07-13 01:57:43+00	Triceps Brachii	triceps	1
13	2025-07-13 01:57:43+00	Brachialis	biceps	1
14	2025-07-13 01:57:43+00	Rectus Femoris	quadriceps	1
15	2025-07-13 01:57:43+00	Vastus Lateralis	quadriceps	1
16	2025-07-13 01:57:43+00	Vastus Medialis	quadriceps	1
17	2025-07-13 01:57:43+00	Bicep Femoris	hamstrings	1
18	2025-07-13 01:57:43+00	Semitendinosus	hamstrings	1
19	2025-07-13 01:57:43+00	Semimembranosus	hamstrings	1
20	2025-07-13 01:57:43+00	Gluteus Medius	glutes	1
21	2025-07-13 01:57:43+00	Gluteus Maximus	glutes	1
22	2025-07-13 01:57:43+00	Gluteus Minimus	glutes	1
23	2025-07-13 01:57:43+00	Gastrocnemius & Soleus	calves	1
24	2025-07-13 01:57:43+00	Rectus Abdominis	core	1
25	2025-07-13 01:57:43+00	Obliques	core	1
26	2025-07-13 01:57:43+00	Transverse Abdominis	core	1
27	2025-07-13 01:57:43+00	Forearm Flexors & Extensors	forearms	1
\.

--
-- Data for Name: exercises; Type: TABLE DATA; Schema: public; Owner: -
--
COPY public.exercises (id, created_at, name, type, movement_pattern_id, version) FROM stdin;
1	2025-07-13 01:57:43+00	Barbell Back Squat	compound	1	1
2	2025-07-13 01:57:43+00	Barbell Front Squat	compound	1	1
3	2025-07-13 01:57:43+00	Sumo Deadlift	compound	3	1
4	2025-07-13 01:57:43+00	Conventional Deadlift	compound	3	1
5	2025-07-13 01:57:43+00	Deficit Straight Legged Deadlift	compound	4	1
6	2025-07-13 01:57:43+00	Overhand Pull-up 	compound	6	1
7	2025-07-13 01:57:43+00	Underhand Pull-up (Chin-up) 	compound	6	1
8	2025-07-13 01:57:43+00	Machine Row (Chest Supported) 	compound	8	1
9	2025-07-13 01:57:43+00	Overhead Press	compound	7	1
10	2025-07-13 01:57:43+00	Lateral raises	isolation	14	1
11	2025-07-13 01:57:43+00	Flat Barbell Bench Press	compound	9	1
12	2025-07-13 01:57:43+00	Incline Barbell Bench Press	compound	9	1
13	2025-07-13 01:57:43+00	Machine Chest Press	compound	9	1
14	2025-07-13 01:57:43+00	Hip Thrust	compound	10	1
15	2025-07-13 01:57:43+00	Dumbbell Pullover	compound	11	1
16	2025-07-13 01:57:43+00	Dumbbell Fly	isolation	12	1
17	2025-07-13 01:57:43+00	Preacher Bicep Curl	isolation	14	1
18	2025-07-13 01:57:43+00	Incline Bicep Curl	isolation	14	1
19	2025-07-13 01:57:43+00	Lying Horizontal Bicep Curl	isolation	14	1
20	2025-07-13 01:57:43+00	Cable Pushdown	isolation	14	1
21	2025-07-13 01:57:43+00	Overhead Tricep Extension	isolation	14	1
22	2025-07-13 01:57:43+00	Front Foot Elevated Split Squat	compound	17	1
23	2025-07-13 01:57:43+00	Hip Abductor Machine	isolation	14	1
24	2025-07-13 01:57:43+00	Seated Leg Extensions	isolation	14	1
25	2025-07-13 01:57:43+00	Lying Leg Curl	isolation	14	1
\.

--
-- Data for Name: exercise_muscles; Type: TABLE DATA; Schema: public; Owner: -
--
COPY public.exercise_muscles (exercise_id, muscle_id, created_at, target_type, version) FROM stdin;
1	14	2025-07-13 01:57:43+00	primary	1
1	15	2025-07-13 01:57:43+00	primary	1
1	16	2025-07-13 01:57:43+00	primary	1
1	21	2025-07-13 01:57:43+00	primary	1
1	17	2025-07-13 01:57:43+00	secondary	1
1	7	2025-07-13 01:57:43+00	secondary	1
2	14	2025-07-13 01:57:43+00	primary	1
2	15	2025-07-13 01:57:43+00	primary	1
2	16	2025-07-13 01:57:43+00	primary	1
2	21	2025-07-13 01:57:43+00	secondary	1
2	7	2025-07-13 01:57:43+00	secondary	1
3	21	2025-07-13 01:57:43+00	primary	1
3	17	2025-07-13 01:57:43+00	primary	1
3	14	2025-07-13 01:57:43+00	secondary	1
3	7	2025-07-13 01:57:43+00	secondary	1
3	5	2025-07-13 01:57:43+00	secondary	1
4	17	2025-07-13 01:57:43+00	primary	1
4	21	2025-07-13 01:57:43+00	primary	1
4	7	2025-07-13 01:57:43+00	primary	1
4	3	2025-07-13 01:57:43+00	secondary	1
4	5	2025-07-13 01:57:43+00	secondary	1
5	17	2025-07-13 01:57:43+00	primary	1
5	18	2025-07-13 01:57:43+00	primary	1
5	19	2025-07-13 01:57:43+00	primary	1
5	21	2025-07-13 01:57:43+00	secondary	1
5	7	2025-07-13 01:57:43+00	secondary	1
6	3	2025-07-13 01:57:43+00	primary	1
6	4	2025-07-13 01:57:43+00	secondary	1
6	5	2025-07-13 01:57:43+00	secondary	1
6	11	2025-07-13 01:57:43+00	secondary	1
6	10	2025-07-13 01:57:43+00	secondary	1
7	3	2025-07-13 01:57:43+00	primary	1
7	11	2025-07-13 01:57:43+00	primary	1
8	3	2025-07-13 01:57:43+00	primary	1
8	4	2025-07-13 01:57:43+00	primary	1
8	5	2025-07-13 01:57:43+00	secondary	1
8	10	2025-07-13 01:57:43+00	secondary	1
9	8	2025-07-13 01:57:43+00	primary	1
9	9	2025-07-13 01:57:43+00	primary	1
9	12	2025-07-13 01:57:43+00	secondary	1
10	9	2025-07-13 01:57:43+00	primary	1
11	1	2025-07-13 01:57:43+00	primary	1
11	8	2025-07-13 01:57:43+00	secondary	1
11	12	2025-07-13 01:57:43+00	secondary	1
12	1	2025-07-13 01:57:43+00	primary	1
12	8	2025-07-13 01:57:43+00	primary	1
12	12	2025-07-13 01:57:43+00	secondary	1
14	21	2025-07-13 01:57:43+00	primary	1
14	17	2025-07-13 01:57:43+00	secondary	1
16	1	2025-07-13 01:57:43+00	primary	1
16	8	2025-07-13 01:57:43+00	secondary	1
17	11	2025-07-13 01:57:43+00	primary	1
17	13	2025-07-13 01:57:43+00	secondary	1
18	11	2025-07-13 01:57:43+00	primary	1
18	13	2025-07-13 01:57:43+00	secondary	1
19	11	2025-07-13 01:57:43+00	primary	1
20	12	2025-07-13 01:57:43+00	primary	1
21	12	2025-07-13 01:57:43+00	primary	1
22	14	2025-07-13 01:57:43+00	primary	1
22	21	2025-07-13 01:57:43+00	primary	1
24	14	2025-07-13 01:57:43+00	primary	1
24	15	2025-07-13 01:57:43+00	primary	1
24	16	2025-07-13 01:57:43+00	primary	1
25	17	2025-07-13 01:57:43+00	primary	1
25	18	2025-07-13 01:57:43+00	primary	1
25	19	2025-07-13 01:57:43+00	primary	1
\.

--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--
COPY public.users (id, created_at, name, email, password_hash, activated, version) FROM stdin;
\.

--
-- Name: exercises_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--
SELECT pg_catalog.setval('public.exercises_id_seq', 25, true);

--
-- Name: movement_patterns_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--
SELECT pg_catalog.setval('public.movement_patterns_id_seq', 17, true);

--
-- Name: muscles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--
SELECT pg_catalog.setval('public.muscles_id_seq', 27, true);

--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--
SELECT pg_catalog.setval('public.users_id_seq', 1, false);

--
-- Name: exercise_muscles exercise_muscles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--
ALTER TABLE ONLY public.exercise_muscles
    ADD CONSTRAINT exercise_muscles_pkey PRIMARY KEY (exercise_id, muscle_id);

--
-- Name: exercises exercises_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--
ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_pkey PRIMARY KEY (id);

--
-- Name: movement_patterns movement_patterns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--
ALTER TABLE ONLY public.movement_patterns
    ADD CONSTRAINT movement_patterns_pkey PRIMARY KEY (id);

--
-- Name: muscles muscles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--
ALTER TABLE ONLY public.muscles
    ADD CONSTRAINT muscles_name_key UNIQUE (name);

--
-- Name: muscles muscles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--
ALTER TABLE ONLY public.muscles
    ADD CONSTRAINT muscles_pkey PRIMARY KEY (id);

--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);

--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

--
-- Name: idx_exercise_muscles_muscle_id; Type: INDEX; Schema: public; Owner: -
--
CREATE INDEX idx_exercise_muscles_muscle_id ON public.exercise_muscles USING btree (muscle_id);

--
-- Name: idx_exercises_movement_pattern_id; Type: INDEX; Schema: public; Owner: -
--
CREATE INDEX idx_exercises_movement_pattern_id ON public.exercises USING btree (movement_pattern_id);

--
-- Name: exercise_muscles exercise_muscles_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--
ALTER TABLE ONLY public.exercise_muscles
    ADD CONSTRAINT exercise_muscles_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id) ON DELETE CASCADE;

--
-- Name: exercise_muscles exercise_muscles_muscle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--
ALTER TABLE ONLY public.exercise_muscles
    ADD CONSTRAINT exercise_muscles_muscle_id_fkey FOREIGN KEY (muscle_id) REFERENCES public.muscles(id) ON DELETE CASCADE;

--
-- Name: exercises exercises_movement_pattern_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--
ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_movement_pattern_id_fkey FOREIGN KEY (movement_pattern_id) REFERENCES public.movement_patterns(id);

--
-- PostgreSQL database dump complete
--
