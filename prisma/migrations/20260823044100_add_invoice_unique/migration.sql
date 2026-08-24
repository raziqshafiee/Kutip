-- CreateIndex
CREATE UNIQUE INDEX "Invoice_clientId_dueDate_key" ON "Invoice"("clientId", "dueDate");