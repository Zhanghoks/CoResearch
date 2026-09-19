# Schema 迁移与类型生成工具选择

Type: grilling
Status: open

## Question

Postgres schema 用什么方式管理：Supabase CLI 的原生 SQL migration（`supabase/migrations/`）+ `supabase gen types typescript` 生成类型，还是引入 ORM（Drizzle / Prisma）做 migration + 类型生成？这个选择会被 09（RLS 策略）间接影响（ORM 对手写 RLS 策略的迁移文件支持程度不同），但本身是独立可决定的工具选型问题，不阻塞其他 ticket。
