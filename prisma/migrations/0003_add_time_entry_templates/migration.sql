-- CreateTable
CREATE TABLE "time_entry_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entries" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_entry_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "time_entry_templates_userId_idx" ON "time_entry_templates"("userId");

-- AddForeignKey
ALTER TABLE "time_entry_templates" ADD CONSTRAINT "time_entry_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
