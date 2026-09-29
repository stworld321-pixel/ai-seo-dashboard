import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getDefaultWebsite } from "@/server/services/dashboard";
import { clamp } from "@/server/intelligence/stats";
import { encryptJson } from "@/server/crypto";
import {
  getConfiguredAiModels,
  type AiProviderId,
} from "@/server/integrations/llm/provider";

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
    name?: string;
    automationLevel?: number;
    timezone?: string;
    country?: string;
    sitemapUrl?: string;
    robotsUrl?: string;
    ga4PropertyId?: string;
    wpUsername?: string;
    wpAppPassword?: string;
    aiModel?: {
      provider: AiProviderId;
      model: string;
      apiKey?: string;
      baseUrl?: string;
      setActive?: boolean;
    };
    setActiveAiIntegrationId?: string;
    deleteAiIntegrationId?: string;
  };

  const website = await getDefaultWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "No website found" } },
      { status: 404 },
    );
  }

  if (body.deleteAiIntegrationId) {
    await prisma.integration
      .delete({
        where: { id: body.deleteAiIntegrationId },
      })
      .catch(() => null);
    const aiModels = await getConfiguredAiModels(website.id);
    return NextResponse.json({ data: website, aiModels });
  }

  if (body.setActiveAiIntegrationId) {
    const existingLlm = await prisma.integration.findMany({
      where: { websiteId: website.id, kind: "LLM" },
    });
    for (const item of existingLlm) {
      const cfg = (item.config ?? {}) as Record<string, unknown>;
      await prisma.integration.update({
        where: { id: item.id },
        data: {
          config: {
            ...cfg,
            isActive: item.id === body.setActiveAiIntegrationId,
          },
        },
      });
    }
    const aiModels = await getConfiguredAiModels(website.id);
    return NextResponse.json({ data: website, aiModels });
  }

  if (body.aiModel && body.aiModel.provider && body.aiModel.model?.trim()) {
    const provider = body.aiModel.provider;
    const modelName = body.aiModel.model.trim();
    const baseUrl = body.aiModel.baseUrl?.trim() || null;
    const setActive = body.aiModel.setActive ?? true;

    if (setActive) {
      const existingLlm = await prisma.integration.findMany({
        where: { websiteId: website.id, kind: "LLM" },
      });
      for (const item of existingLlm) {
        if (item.provider === provider) continue;
        const cfg = (item.config ?? {}) as Record<string, unknown>;
        if (cfg.isActive) {
          await prisma.integration.update({
            where: { id: item.id },
            data: { config: { ...cfg, isActive: false } },
          });
        }
      }
    }

    const hasNewSecret = Boolean(body.aiModel.apiKey && body.aiModel.apiKey.trim());
    const secret = hasNewSecret
      ? encryptJson({ apiKey: body.aiModel.apiKey!.trim() })
      : null;

    await prisma.integration.upsert({
      where: {
        websiteId_kind_provider: {
          websiteId: website.id,
          kind: "LLM",
          provider,
        },
      },
      create: {
        websiteId: website.id,
        kind: "LLM",
        provider,
        externalId: modelName,
        config: {
          model: modelName,
          baseUrl,
          isActive: setActive,
        },
        status: "ACTIVE",
        lastSyncAt: new Date(),
        ...(secret
          ? {
              secretCipher: secret.cipher,
              secretIv: secret.iv,
              secretTag: secret.tag,
            }
          : {}),
      },
      update: {
        externalId: modelName,
        config: {
          model: modelName,
          baseUrl,
          isActive: setActive,
        },
        status: "ACTIVE",
        lastSyncAt: new Date(),
        ...(secret
          ? {
              secretCipher: secret.cipher,
              secretIv: secret.iv,
              secretTag: secret.tag,
            }
          : {}),
      },
    });
  }

  const updated = await prisma.website.update({
    where: { id: website.id },
    data: {
      ...(body.name ? { name: body.name.trim() } : {}),
      ...(typeof body.automationLevel === "number"
        ? { automationLevel: clamp(Math.round(body.automationLevel), 1, 5) }
        : {}),
      ...(body.timezone ? { timezone: body.timezone.trim() } : {}),
      ...(body.country ? { country: body.country.trim().toUpperCase() } : {}),
      ...(body.sitemapUrl !== undefined ? { sitemapUrl: body.sitemapUrl.trim() || null } : {}),
      ...(body.robotsUrl !== undefined ? { robotsUrl: body.robotsUrl.trim() || null } : {}),
      ...(body.ga4PropertyId !== undefined
        ? { ga4PropertyId: body.ga4PropertyId.trim() || null }
        : {}),
    },
  });

  if (body.wpUsername && body.wpAppPassword) {
    const secret = encryptJson({
      username: body.wpUsername.trim(),
      appPassword: body.wpAppPassword.trim(),
    });
    await prisma.integration.upsert({
      where: {
        websiteId_kind_provider: {
          websiteId: website.id,
          kind: "CMS",
          provider: "wordpress",
        },
      },
      create: {
        websiteId: website.id,
        kind: "CMS",
        provider: "wordpress",
        config: { siteUrl: website.url.replace(/\/+$/, ""), seoPlugin: "rank_math" },
        status: "ACTIVE",
        secretCipher: secret.cipher,
        secretIv: secret.iv,
        secretTag: secret.tag,
      },
      update: {
        status: "ACTIVE",
        secretCipher: secret.cipher,
        secretIv: secret.iv,
        secretTag: secret.tag,
      },
    });
  }

  const aiModels = await getConfiguredAiModels(website.id);
  return NextResponse.json({ data: updated, aiModels });
}
