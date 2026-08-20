using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lootta.Migrations
{
    /// <inheritdoc />
    public partial class AddStoreContent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PaymentMethodSettings",
                columns: table => new
                {
                    Method = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    IsEnabled = table.Column<bool>(type: "bit", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaymentMethodSettings", x => x.Method);
                });

            migrationBuilder.CreateTable(
                name: "QuickTags",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Label = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Query = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuickTags", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SiteTexts",
                columns: table => new
                {
                    Key = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    Value = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SiteTexts", x => x.Key);
                });

            migrationBuilder.CreateIndex(
                name: "IX_QuickTags_Label",
                table: "QuickTags",
                column: "Label",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QuickTags_SortOrder",
                table: "QuickTags",
                column: "SortOrder");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PaymentMethodSettings");

            migrationBuilder.DropTable(
                name: "QuickTags");

            migrationBuilder.DropTable(
                name: "SiteTexts");
        }
    }
}
