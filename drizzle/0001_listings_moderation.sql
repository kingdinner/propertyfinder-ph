CREATE TYPE "public"."listing_transaction" AS ENUM('sale', 'rent');--> statement-breakpoint
CREATE TYPE "public"."listing_category" AS ENUM('house_lot', 'condo', 'townhouse', 'lot', 'commercial');--> statement-breakpoint
CREATE TYPE "public"."construction_status" AS ENUM('rfo', 'preselling', 'resale');--> statement-breakpoint
CREATE TYPE "public"."furnishing_status" AS ENUM('unfurnished', 'semi_furnished', 'furnished');--> statement-breakpoint
CREATE TYPE "public"."declared_title_status" AS ENUM('clean_tct_cct', 'mortgaged', 'tax_declaration', 'estate_settlement', 'unspecified');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('draft', 'pending_review', 'needs_revision', 'rejected', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."financing_option" AS ENUM('cash', 'bank', 'in_house', 'pagibig');--> statement-breakpoint
CREATE TYPE "public"."listing_document_kind" AS ENUM('title', 'tax', 'other');--> statement-breakpoint
CREATE TYPE "public"."moderation_queue_status" AS ENUM('pending', 'needs_revision', 'flagged', 'decided');--> statement-breakpoint
CREATE TYPE "public"."moderation_outcome" AS ENUM('approve', 'request_changes', 'reject');--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_code" text NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"broker_user_id" uuid,
	"transaction" "listing_transaction" NOT NULL,
	"category" "listing_category" NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"construction_status" "construction_status" DEFAULT 'resale' NOT NULL,
	"furnishing" "furnishing_status" DEFAULT 'unfurnished' NOT NULL,
	"bedrooms" integer DEFAULT 0 NOT NULL,
	"bathrooms" integer DEFAULT 0 NOT NULL,
	"powder_rooms" integer DEFAULT 0 NOT NULL,
	"parking_slots" integer DEFAULT 0 NOT NULL,
	"floor_area_sqm" numeric(12, 2),
	"lot_area_sqm" numeric(12, 2),
	"declared_title_status" "declared_title_status" DEFAULT 'unspecified' NOT NULL,
	"price_php_centavos" integer DEFAULT 0 NOT NULL,
	"price_negotiable" boolean DEFAULT false NOT NULL,
	"hoa_dues_php_centavos" integer,
	"rpt_status" text,
	"province" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"barangay" text DEFAULT '' NOT NULL,
	"postal_code" text,
	"subdivision" text,
	"street_address" text,
	"lat" double precision,
	"lng" double precision,
	"status" "listing_status" DEFAULT 'draft' NOT NULL,
	"moderation_note" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "listing_financing_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"option" "financing_option" NOT NULL
);--> statement-breakpoint
CREATE TABLE "listing_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_cover" boolean DEFAULT false NOT NULL,
	"alt_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "listing_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"kind" "listing_document_kind" DEFAULT 'other' NOT NULL,
	"visibility" text DEFAULT 'admin_only' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "listing_status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"from_status" "listing_status",
	"to_status" "listing_status" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "moderation_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"queue_status" "moderation_queue_status" DEFAULT 'pending' NOT NULL,
	"assignee_user_id" uuid,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE "moderation_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"outcome" "moderation_outcome" NOT NULL,
	"note_to_lister" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_broker_user_id_users_id_fk" FOREIGN KEY ("broker_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_financing_options" ADD CONSTRAINT "listing_financing_options_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_media" ADD CONSTRAINT "listing_media_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_documents" ADD CONSTRAINT "listing_documents_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_status_events" ADD CONSTRAINT "listing_status_events_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_status_events" ADD CONSTRAINT "listing_status_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_decisions" ADD CONSTRAINT "moderation_decisions_case_id_moderation_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."moderation_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_decisions" ADD CONSTRAINT "moderation_decisions_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "listings_public_code_uidx" ON "listings" USING btree ("public_code");--> statement-breakpoint
CREATE INDEX "listings_owner_idx" ON "listings" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "listings_broker_idx" ON "listings" USING btree ("broker_user_id");--> statement-breakpoint
CREATE INDEX "listings_status_tx_city_idx" ON "listings" USING btree ("status","transaction","city");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_financing_uidx" ON "listing_financing_options" USING btree ("listing_id","option");--> statement-breakpoint
CREATE INDEX "listing_media_listing_idx" ON "listing_media" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "listing_documents_listing_idx" ON "listing_documents" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "listing_status_events_listing_idx" ON "listing_status_events" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "moderation_cases_listing_idx" ON "moderation_cases" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "moderation_cases_queue_idx" ON "moderation_cases" USING btree ("queue_status");
