-- AlterTable
ALTER TABLE "inbound_messages" ADD COLUMN     "source_ref" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "inbound_messages_user_id_source_ref_key" ON "inbound_messages"("user_id", "source_ref");
