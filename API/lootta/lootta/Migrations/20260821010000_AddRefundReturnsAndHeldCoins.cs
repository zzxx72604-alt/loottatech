using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using lootta.Data;

#nullable disable

namespace lootta.Migrations
{
    /// <summary>
    /// The rest of the refund story: photos as evidence, the arrangement for
    /// getting a delivered item back, and the flag that records whether an
    /// order's coins were ever actually paid.
    /// </summary>
    [DbContext(typeof(LoottaDbContext))]
    [Migration("20260821010000_AddRefundReturnsAndHeldCoins")]
    public partial class AddRefundReturnsAndHeldCoins : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "CoinsCredited",
                table: "Orders",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "RefundedAt",
                table: "Orders",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReturnMethod",
                table: "Orders",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReturnAddress",
                table: "Orders",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ReturnNote",
                table: "Orders",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "ReturnArrangedAt",
                table: "Orders",
                type: "datetime2",
                nullable: true);

            /*
             * Every order placed before this migration was credited its coins
             * at checkout, under the old rule. Marking them as already paid
             * keeps that true: without it, completing one of those orders
             * would pay the same coins a second time.
             */
            migrationBuilder.Sql("UPDATE [Orders] SET [CoinsCredited] = 1 WHERE [CoinsEarned] > 0;");

            migrationBuilder.CreateTable(
                name: "RefundPhotos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrderId = table.Column<int>(type: "int", nullable: false),
                    Path = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RefundPhotos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RefundPhotos_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RefundPhotos_OrderId",
                table: "RefundPhotos",
                column: "OrderId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "RefundPhotos");

            migrationBuilder.DropColumn(name: "CoinsCredited", table: "Orders");
            migrationBuilder.DropColumn(name: "RefundedAt", table: "Orders");
            migrationBuilder.DropColumn(name: "ReturnMethod", table: "Orders");
            migrationBuilder.DropColumn(name: "ReturnAddress", table: "Orders");
            migrationBuilder.DropColumn(name: "ReturnNote", table: "Orders");
            migrationBuilder.DropColumn(name: "ReturnArrangedAt", table: "Orders");
        }
    }
}
