using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using lootta.Data;

#nullable disable

namespace lootta.Migrations
{
    /// <summary>
    /// Refunds: the customer can ask for their money back, and an admin
    /// answers. Four columns on Orders, all nullable or defaulted, so an
    /// existing shop keeps every order it already had.
    /// </summary>
    [DbContext(typeof(LoottaDbContext))]
    [Migration("20260821000000_AddOrderRefunds")]
    public partial class AddOrderRefunds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Refund",
                table: "Orders",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "None");

            migrationBuilder.AddColumn<string>(
                name: "RefundReason",
                table: "Orders",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "RefundRequestedAt",
                table: "Orders",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RefundDecidedAt",
                table: "Orders",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "Refund", table: "Orders");
            migrationBuilder.DropColumn(name: "RefundReason", table: "Orders");
            migrationBuilder.DropColumn(name: "RefundRequestedAt", table: "Orders");
            migrationBuilder.DropColumn(name: "RefundDecidedAt", table: "Orders");
        }
    }
}
