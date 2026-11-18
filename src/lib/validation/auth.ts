import { z } from "zod";
import { ROLES } from "@/lib/auth/rbac";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long");

export const registerSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255).transform((value) => value.toLowerCase()),
  password: passwordSchema,
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  role: z.enum(["CUSTOMER", "PROPERTY_OWNER", "REAL_ESTATE_AGENT"]),
  consent: z.boolean().refine((value) => value === true, { message: "Consent is required" }),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  password: z.string().min(1, "Password is required").max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(20).max(200),
});

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  activePortal: z.enum(ROLES).nullable().optional(),
  broker: z
    .object({
      displayName: z.string().trim().min(2).max(120).optional(),
      agencyName: z.string().trim().max(160).optional().or(z.literal("")),
      prcLicenseNo: z.string().trim().max(64).optional().or(z.literal("")),
      dhsudRegistrationNo: z.string().trim().max(64).optional().or(z.literal("")),
      bio: z.string().trim().max(2000).optional().or(z.literal("")),
    })
    .optional(),
});

export const suspendUserSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
