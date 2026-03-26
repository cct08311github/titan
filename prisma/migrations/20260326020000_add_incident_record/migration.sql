-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('SEV1', 'SEV2', 'SEV3', 'SEV4');

-- CreateTable
CREATE TABLE "incident_records" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "impactScope" TEXT NOT NULL,
    "incidentStart" TIMESTAMP(3) NOT NULL,
    "incidentEnd" TIMESTAMP(3),
    "rootCause" TEXT,
    "resolution" TEXT,
    "mttrMinutes" INTEGER,
    "reportedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incident_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "incident_records_taskId_key" ON "incident_records"("taskId");

-- AddForeignKey
ALTER TABLE "incident_records" ADD CONSTRAINT "incident_records_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
