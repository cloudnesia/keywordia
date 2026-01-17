/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `MindMap` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "MindMap" ADD COLUMN     "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MindMap_slug_key" ON "MindMap"("slug");
