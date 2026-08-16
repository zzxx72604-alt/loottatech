using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lootta.Migrations
{
    /// <inheritdoc />
    public partial class AddEconomyConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "UserId",
                table: "Vouchers",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<bool>(
                name: "IsAdminIssued",
                table: "Vouchers",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "CoinsEarned",
                table: "Orders",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "EconomyConfigs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CoinsPerDollar = table.Column<int>(type: "int", nullable: false),
                    PlayCost = table.Column<int>(type: "int", nullable: false),
                    FlyerCoinsPerPoint = table.Column<int>(type: "int", nullable: false),
                    FlyerMaxPerRound = table.Column<int>(type: "int", nullable: false),
                    CoinsPerVoucherDollar = table.Column<int>(type: "int", nullable: false),
                    VoucherMinSpendMultiplier = table.Column<int>(type: "int", nullable: false),
                    VoucherExpiryDays = table.Column<int>(type: "int", nullable: false),
                    BronzeItems = table.Column<int>(type: "int", nullable: false),
                    BronzePlays = table.Column<int>(type: "int", nullable: false),
                    SilverItems = table.Column<int>(type: "int", nullable: false),
                    SilverPlays = table.Column<int>(type: "int", nullable: false),
                    GoldItems = table.Column<int>(type: "int", nullable: false),
                    GoldPlays = table.Column<int>(type: "int", nullable: false),
                    WelcomeCoins = table.Column<int>(type: "int", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EconomyConfigs", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "EconomyConfigs",
                columns: new[] { "Id", "BronzeItems", "BronzePlays", "CoinsPerDollar", "CoinsPerVoucherDollar", "FlyerCoinsPerPoint", "FlyerMaxPerRound", "GoldItems", "GoldPlays", "PlayCost", "SilverItems", "SilverPlays", "UpdatedAt", "VoucherExpiryDays", "VoucherMinSpendMultiplier", "WelcomeCoins" },
                values: new object[] { 1, 1, 1, 40, 300, 8, 400, 20, 4, 50, 5, 2, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), 30, 10, 100 });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EconomyConfigs");

            migrationBuilder.DropColumn(
                name: "IsAdminIssued",
                table: "Vouchers");

            migrationBuilder.DropColumn(
                name: "CoinsEarned",
                table: "Orders");

            migrationBuilder.AlterColumn<int>(
                name: "UserId",
                table: "Vouchers",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);
        }
    }
}
