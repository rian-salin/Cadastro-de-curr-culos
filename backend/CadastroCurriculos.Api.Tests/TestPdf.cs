using UglyToad.PdfPig.Content;
using UglyToad.PdfPig.Core;
using UglyToad.PdfPig.Fonts.Standard14Fonts;
using UglyToad.PdfPig.Writer;

namespace CadastroCurriculos.Api.Tests;

// PDFs gerados na hora, sem binários no repositório. A fonte padrão (Helvetica) não
// codifica acentos corretamente na extração, então o texto dos testes vai sem acento.
internal static class TestPdf
{
    public static byte[] WithLines(params string[] lines)
    {
        var builder = new PdfDocumentBuilder();
        var page = builder.AddPage(PageSize.A4);
        var font = builder.AddStandard14Font(Standard14Font.Helvetica);
        var y = 800.0;

        foreach (var line in lines)
        {
            page.AddText(line, 12, new PdfPoint(50, y), font);
            y -= 20;
        }

        return builder.Build();
    }
}
