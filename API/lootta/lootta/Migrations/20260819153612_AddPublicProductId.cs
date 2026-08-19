using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace lootta.Migrations
{
    /// <inheritdoc />
    public partial class AddPublicProductId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PublicId",
                table: "Products",
                type: "nvarchar(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "");

            /*
             * Give every EXISTING product a code before the unique index is
             * created. Without this the migration fails on any database that
             * already has products: they would all share the default empty
             * string, and an empty string is not unique ten times over.
             *
             * NEWID() produces a different value per row, so this works in one
             * statement rather than a loop.
             */
            migrationBuilder.Sql(@"
                UPDATE [Products]
                SET [PublicId] = LOWER(LEFT(REPLACE(CONVERT(varchar(36), NEWID()), '-', ''), 9))
                WHERE [PublicId] IS NULL OR [PublicId] = '';
            ");

            migrationBuilder.CreateIndex(
                name: "IX_Products_PublicId",
                table: "Products",
                column: "PublicId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Products_PublicId",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "PublicId",
                table: "Products");
        }
    }
}
