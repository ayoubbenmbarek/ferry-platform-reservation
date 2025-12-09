#!/usr/bin/env node

/**
 * Maritime Reservation Platform - PostgreSQL MCP Server
 *
 * This MCP server provides read-only access to the Maritime Reservation database
 * for AI assistants to answer questions about bookings, users, ferries, and more.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import pg from "pg";
import { z } from "zod";

const { Pool } = pg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/maritime_reservations_dev",
  max: 5,
  idleTimeoutMillis: 30000,
});

// Schema definitions for tools
const QuerySchema = z.object({
  query: z.string().describe("SQL query to execute (SELECT only)"),
});

const BookingLookupSchema = z.object({
  booking_reference: z.string().optional().describe("Booking reference (e.g., MR1234ABCD)"),
  email: z.string().optional().describe("Customer email address"),
  booking_id: z.number().optional().describe("Booking ID"),
});

const FerrySearchSchema = z.object({
  departure_port: z.string().optional().describe("Departure port name"),
  arrival_port: z.string().optional().describe("Arrival port name"),
  date: z.string().optional().describe("Travel date (YYYY-MM-DD)"),
  operator: z.string().optional().describe("Ferry operator name"),
});

const UserLookupSchema = z.object({
  email: z.string().optional().describe("User email"),
  user_id: z.number().optional().describe("User ID"),
});

const StatsSchema = z.object({
  period: z.enum(["today", "week", "month", "year"]).optional().describe("Time period for statistics"),
});

// Create MCP server
const server = new Server(
  {
    name: "maritime-postgres-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "postgres://schema",
        name: "Database Schema",
        description: "View all tables and their structures in the Maritime database",
        mimeType: "application/json",
      },
      {
        uri: "postgres://stats/overview",
        name: "Platform Statistics",
        description: "Overview statistics of the platform",
        mimeType: "application/json",
      },
      {
        uri: "postgres://routes",
        name: "Ferry Routes",
        description: "List of all available ferry routes",
        mimeType: "application/json",
      },
    ],
  };
});

// Read resource content
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  if (uri === "postgres://schema") {
    const result = await pool.query(`
      SELECT
        table_name,
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `);

    // Group by table
    const schema: Record<string, Array<{ column: string; type: string; nullable: string }>> = {};
    for (const row of result.rows) {
      if (!schema[row.table_name]) {
        schema[row.table_name] = [];
      }
      schema[row.table_name].push({
        column: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable,
      });
    }

    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(schema, null, 2),
        },
      ],
    };
  }

  if (uri === "postgres://stats/overview") {
    const stats = await getOverviewStats();
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(stats, null, 2),
        },
      ],
    };
  }

  if (uri === "postgres://routes") {
    const result = await pool.query(`
      SELECT DISTINCT
        departure_port,
        arrival_port,
        COUNT(*) as trip_count
      FROM bookings
      GROUP BY departure_port, arrival_port
      ORDER BY trip_count DESC
    `);

    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(result.rows, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "query",
        description: "Execute a read-only SQL query on the Maritime database. Only SELECT statements are allowed.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "SQL SELECT query to execute",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "lookup_booking",
        description: "Look up booking details by reference, email, or ID",
        inputSchema: {
          type: "object",
          properties: {
            booking_reference: {
              type: "string",
              description: "Booking reference (e.g., MR1234ABCD)",
            },
            email: {
              type: "string",
              description: "Customer email address",
            },
            booking_id: {
              type: "number",
              description: "Booking ID",
            },
          },
        },
      },
      {
        name: "search_ferries",
        description: "Search for ferry bookings by route, date, or operator",
        inputSchema: {
          type: "object",
          properties: {
            departure_port: {
              type: "string",
              description: "Departure port name",
            },
            arrival_port: {
              type: "string",
              description: "Arrival port name",
            },
            date: {
              type: "string",
              description: "Travel date (YYYY-MM-DD)",
            },
            operator: {
              type: "string",
              description: "Ferry operator name",
            },
          },
        },
      },
      {
        name: "lookup_user",
        description: "Look up user information by email or ID",
        inputSchema: {
          type: "object",
          properties: {
            email: {
              type: "string",
              description: "User email",
            },
            user_id: {
              type: "number",
              description: "User ID",
            },
          },
        },
      },
      {
        name: "get_statistics",
        description: "Get platform statistics for a given time period",
        inputSchema: {
          type: "object",
          properties: {
            period: {
              type: "string",
              enum: ["today", "week", "month", "year"],
              description: "Time period for statistics",
            },
          },
        },
      },
      {
        name: "get_recent_bookings",
        description: "Get the most recent bookings",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Number of bookings to return (default 10, max 50)",
            },
            status: {
              type: "string",
              enum: ["pending", "confirmed", "cancelled", "completed"],
              description: "Filter by booking status",
            },
          },
        },
      },
      {
        name: "get_price_alerts",
        description: "Get active price alerts for saved routes",
        inputSchema: {
          type: "object",
          properties: {
            email: {
              type: "string",
              description: "Filter by user email",
            },
            route: {
              type: "string",
              description: "Filter by route (e.g., 'marseille-tunis')",
            },
          },
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "query": {
        const { query } = QuerySchema.parse(args);

        // Security: Only allow SELECT queries
        const normalizedQuery = query.trim().toLowerCase();
        if (
          !normalizedQuery.startsWith("select") ||
          normalizedQuery.includes("insert") ||
          normalizedQuery.includes("update") ||
          normalizedQuery.includes("delete") ||
          normalizedQuery.includes("drop") ||
          normalizedQuery.includes("alter") ||
          normalizedQuery.includes("truncate") ||
          normalizedQuery.includes("create")
        ) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Only SELECT queries are allowed for security reasons.",
              },
            ],
          };
        }

        const result = await pool.query(query);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  rowCount: result.rowCount,
                  rows: result.rows.slice(0, 100), // Limit to 100 rows
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "lookup_booking": {
        const { booking_reference, email, booking_id } = BookingLookupSchema.parse(args);

        let whereClause = "";
        const params: (string | number)[] = [];

        if (booking_id) {
          whereClause = "b.id = $1";
          params.push(booking_id);
        } else if (booking_reference) {
          whereClause = "b.booking_reference = $1";
          params.push(booking_reference);
        } else if (email) {
          whereClause = "b.email = $1";
          params.push(email);
        } else {
          return {
            content: [{ type: "text", text: "Please provide booking_reference, email, or booking_id" }],
          };
        }

        const result = await pool.query(
          `
          SELECT
            b.id,
            b.booking_reference,
            b.email,
            b.status,
            b.departure_port,
            b.arrival_port,
            b.departure_date,
            b.return_date,
            b.operator,
            b.total_price,
            b.currency,
            b.adults,
            b.children,
            b.infants,
            b.created_at,
            b.payment_status,
            u.first_name,
            u.last_name
          FROM bookings b
          LEFT JOIN users u ON b.user_id = u.id
          WHERE ${whereClause}
          ORDER BY b.created_at DESC
          LIMIT 10
        `,
          params
        );

        return {
          content: [
            {
              type: "text",
              text:
                result.rows.length > 0
                  ? JSON.stringify(result.rows, null, 2)
                  : "No bookings found with the provided criteria.",
            },
          ],
        };
      }

      case "search_ferries": {
        const { departure_port, arrival_port, date, operator } = FerrySearchSchema.parse(args);

        const conditions: string[] = [];
        const params: string[] = [];
        let paramIndex = 1;

        if (departure_port) {
          conditions.push(`LOWER(departure_port) LIKE LOWER($${paramIndex})`);
          params.push(`%${departure_port}%`);
          paramIndex++;
        }
        if (arrival_port) {
          conditions.push(`LOWER(arrival_port) LIKE LOWER($${paramIndex})`);
          params.push(`%${arrival_port}%`);
          paramIndex++;
        }
        if (date) {
          conditions.push(`departure_date::date = $${paramIndex}`);
          params.push(date);
          paramIndex++;
        }
        if (operator) {
          conditions.push(`LOWER(operator) LIKE LOWER($${paramIndex})`);
          params.push(`%${operator}%`);
          paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const result = await pool.query(
          `
          SELECT
            id,
            booking_reference,
            departure_port,
            arrival_port,
            departure_date,
            operator,
            status,
            total_price,
            adults,
            children
          FROM bookings
          ${whereClause}
          ORDER BY departure_date DESC
          LIMIT 20
        `,
          params
        );

        return {
          content: [
            {
              type: "text",
              text:
                result.rows.length > 0
                  ? JSON.stringify(result.rows, null, 2)
                  : "No ferry bookings found with the provided criteria.",
            },
          ],
        };
      }

      case "lookup_user": {
        const { email, user_id } = UserLookupSchema.parse(args);

        let whereClause = "";
        const params: (string | number)[] = [];

        if (user_id) {
          whereClause = "u.id = $1";
          params.push(user_id);
        } else if (email) {
          whereClause = "u.email = $1";
          params.push(email);
        } else {
          return {
            content: [{ type: "text", text: "Please provide email or user_id" }],
          };
        }

        const result = await pool.query(
          `
          SELECT
            u.id,
            u.email,
            u.first_name,
            u.last_name,
            u.phone,
            u.is_verified,
            u.is_admin,
            u.created_at,
            COUNT(DISTINCT b.id) as booking_count,
            COALESCE(SUM(b.total_price), 0) as total_spent
          FROM users u
          LEFT JOIN bookings b ON u.id = b.user_id
          WHERE ${whereClause}
          GROUP BY u.id
        `,
          params
        );

        if (result.rows.length === 0) {
          return {
            content: [{ type: "text", text: "User not found." }],
          };
        }

        // Don't expose password hash
        const user = result.rows[0];
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(user, null, 2),
            },
          ],
        };
      }

      case "get_statistics": {
        const { period } = StatsSchema.parse(args);
        const stats = await getStatistics(period || "month");

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      }

      case "get_recent_bookings": {
        const limit = Math.min(args?.limit || 10, 50);
        const status = args?.status;

        let query = `
          SELECT
            id,
            booking_reference,
            email,
            departure_port,
            arrival_port,
            departure_date,
            status,
            total_price,
            created_at
          FROM bookings
        `;

        const params: string[] = [];
        if (status) {
          query += " WHERE status = $1";
          params.push(status);
        }

        query += " ORDER BY created_at DESC LIMIT $" + (params.length + 1);
        params.push(limit.toString());

        const result = await pool.query(query, params);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result.rows, null, 2),
            },
          ],
        };
      }

      case "get_price_alerts": {
        const conditions: string[] = ["status = 'active'"];
        const params: string[] = [];
        let paramIndex = 1;

        if (args?.email) {
          conditions.push(`email = $${paramIndex}`);
          params.push(args.email);
          paramIndex++;
        }

        if (args?.route) {
          const [dep, arr] = args.route.split("-");
          if (dep) {
            conditions.push(`LOWER(departure_port) = LOWER($${paramIndex})`);
            params.push(dep);
            paramIndex++;
          }
          if (arr) {
            conditions.push(`LOWER(arrival_port) = LOWER($${paramIndex})`);
            params.push(arr);
            paramIndex++;
          }
        }

        const result = await pool.query(
          `
          SELECT
            id,
            email,
            departure_port,
            arrival_port,
            date_from,
            date_to,
            initial_price,
            current_price,
            lowest_price,
            highest_price,
            notify_on_drop,
            notify_on_increase,
            created_at,
            last_notified_at
          FROM price_alerts
          WHERE ${conditions.join(" AND ")}
          ORDER BY created_at DESC
          LIMIT 20
        `,
          params
        );

        return {
          content: [
            {
              type: "text",
              text:
                result.rows.length > 0
                  ? JSON.stringify(result.rows, null, 2)
                  : "No active price alerts found.",
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
    };
  }
});

// Helper functions
async function getOverviewStats() {
  const [bookings, users, revenue, routes] = await Promise.all([
    pool.query("SELECT COUNT(*) as total, status FROM bookings GROUP BY status"),
    pool.query("SELECT COUNT(*) as total FROM users"),
    pool.query("SELECT COALESCE(SUM(total_price), 0) as total FROM bookings WHERE status = 'confirmed'"),
    pool.query(`
      SELECT departure_port, arrival_port, COUNT(*) as count
      FROM bookings
      GROUP BY departure_port, arrival_port
      ORDER BY count DESC
      LIMIT 5
    `),
  ]);

  return {
    bookings: bookings.rows.reduce(
      (acc, row) => ({ ...acc, [row.status]: parseInt(row.total) }),
      {} as Record<string, number>
    ),
    total_users: parseInt(users.rows[0].total),
    total_revenue: parseFloat(revenue.rows[0].total),
    top_routes: routes.rows,
  };
}

async function getStatistics(period: string) {
  let dateFilter = "";
  switch (period) {
    case "today":
      dateFilter = "created_at >= CURRENT_DATE";
      break;
    case "week":
      dateFilter = "created_at >= CURRENT_DATE - INTERVAL '7 days'";
      break;
    case "month":
      dateFilter = "created_at >= CURRENT_DATE - INTERVAL '30 days'";
      break;
    case "year":
      dateFilter = "created_at >= CURRENT_DATE - INTERVAL '365 days'";
      break;
  }

  const [bookings, revenue, newUsers, avgBookingValue] = await Promise.all([
    pool.query(`SELECT COUNT(*) as total FROM bookings WHERE ${dateFilter}`),
    pool.query(`SELECT COALESCE(SUM(total_price), 0) as total FROM bookings WHERE status = 'confirmed' AND ${dateFilter}`),
    pool.query(`SELECT COUNT(*) as total FROM users WHERE ${dateFilter}`),
    pool.query(`SELECT COALESCE(AVG(total_price), 0) as avg FROM bookings WHERE status = 'confirmed' AND ${dateFilter}`),
  ]);

  return {
    period,
    bookings: parseInt(bookings.rows[0].total),
    revenue: parseFloat(revenue.rows[0].total),
    new_users: parseInt(newUsers.rows[0].total),
    average_booking_value: parseFloat(avgBookingValue.rows[0].avg).toFixed(2),
  };
}

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Maritime PostgreSQL MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
