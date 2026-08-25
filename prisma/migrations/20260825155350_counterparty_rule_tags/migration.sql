-- CreateTable
CREATE TABLE "_CounterpartyRuleToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CounterpartyRuleToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_CounterpartyRuleToTag_B_index" ON "_CounterpartyRuleToTag"("B");

-- AddForeignKey
ALTER TABLE "_CounterpartyRuleToTag" ADD CONSTRAINT "_CounterpartyRuleToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "CounterpartyRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CounterpartyRuleToTag" ADD CONSTRAINT "_CounterpartyRuleToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
