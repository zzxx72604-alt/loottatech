using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lootta.Migrations
{
    /// <inheritdoc />
    public partial class AddReportsPaymentAndAccountNumbers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PublicId",
                table: "Users",
                type: "nvarchar(12)",
                maxLength: 12,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "IsPaid",
                table: "Orders",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "PaymentMethod",
                table: "Orders",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "Reports",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ReporterId = table.Column<int>(type: "int", nullable: false),
                    Target = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    TargetId = table.Column<int>(type: "int", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    Details = table.Column<string>(type: "nvarchar(600)", maxLength: 600, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Resolution = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ResolvedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Reports", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Reports_Users_ReporterId",
                        column: x => x.ReporterId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            /*
             * Give every EXISTING account a number before the unique index
             * exists. They all default to an empty string, and an empty string
             * is not unique eight times over — the index would fail.
             *
             * The format matches PublicIdGenerator.NextUser(): two letters and
             * four digits, e.g. "UE8145". NEWID() gives a different value per
             * row, so this is one statement rather than a loop.
             */
            migrationBuilder.Sql(@"
                UPDATE [Users]
                SET [PublicId] =
                    CHAR(65 + ABS(CHECKSUM(NEWID())) % 26) +
                    CHAR(65 + ABS(CHECKSUM(NEWID())) % 26) +
                    RIGHT('000' + CAST(1000 + ABS(CHECKSUM(NEWID())) % 9000 AS varchar(4)), 4)
                WHERE [PublicId] IS NULL OR [PublicId] = '';
            ");

            migrationBuilder.CreateIndex(
                name: "IX_Users_PublicId",
                table: "Users",
                column: "PublicId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Reports_ReporterId_Target_TargetId",
                table: "Reports",
                columns: new[] { "ReporterId", "Target", "TargetId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Reports_Status_CreatedAt",
                table: "Reports",
                columns: new[] { "Status", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Reports");

            migrationBuilder.DropIndex(
                name: "IX_Users_PublicId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PublicId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "IsPaid",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "PaymentMethod",
                table: "Orders");
        }
    }
}
