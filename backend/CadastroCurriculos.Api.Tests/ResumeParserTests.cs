using CadastroCurriculos.Api.Resumes;

namespace CadastroCurriculos.Api.Tests;

public class ResumeParserTests
{
    [Fact]
    public void Parse_FindsFirstEmailInLowerCase()
    {
        var result = ResumeParser.Parse("Contato: Maria.Souza@Example.COM\noutro@example.com");

        Assert.Equal("maria.souza@example.com", result.Email);
    }

    [Fact]
    public void Parse_EmailAtEndOfSentence_DropsTrailingPeriod()
    {
        var result = ResumeParser.Parse("Escreva para maria@example.com.");

        Assert.Equal("maria@example.com", result.Email);
    }

    [Fact]
    public void Parse_WithoutEmail_ReturnsNullEmail()
    {
        Assert.Null(ResumeParser.Parse("Maria Souza\n(11) 98888-7777").Email);
    }

    [Theory]
    [InlineData("(11) 98888-7777")]
    [InlineData("+55 11 98888-7777")]
    [InlineData("+55 (11) 98888-7777")]
    [InlineData("11 98888-7777")]
    [InlineData("11988887777")]
    [InlineData("(11) 3333-4444")]
    public void Parse_FindsBrazilianPhoneWithAreaCode(string phone)
    {
        var result = ResumeParser.Parse($"Telefone: {phone}\nSao Paulo");

        Assert.Equal(phone, result.Phone);
    }

    [Theory]
    [InlineData("Empresa X, 2019-2021")]
    [InlineData("CPF: 123.456.789-00")]
    [InlineData("CEP 01310-100")]
    [InlineData("CNPJ 12345678000190")]
    [InlineData("Telefone: 98888-7777")]
    public void Parse_IgnoresNumbersThatAreNotPhonesWithAreaCode(string text)
    {
        Assert.Null(ResumeParser.Parse(text).Phone);
    }

    [Fact]
    public void Parse_TakesFirstLineThatLooksLikeName()
    {
        var result = ResumeParser.Parse("Maria Souza\nDesenvolvedora Backend\nmaria@example.com");

        Assert.Equal("Maria Souza", result.FullName);
    }

    [Theory]
    [InlineData("Nome: João da Silva")]
    [InlineData("NOME COMPLETO: João da Silva")]
    public void Parse_PrefersLabeledName(string labeledLine)
    {
        var text = $"Desenvolvedor Backend\nDados Pessoais\n{labeledLine}\nE-mail: joao@example.com";

        Assert.Equal("João da Silva", ResumeParser.Parse(text).FullName);
    }

    [Theory]
    [InlineData("Curriculum Vitae\nMaria Souza")]
    [InlineData("CURRICULUM VITAE\nMaria Souza")]
    [InlineData("CURRÍCULO ATUALIZADO\nMaria Souza")]
    [InlineData("Dados Pessoais\nMaria Souza")]
    public void Parse_SkipsHeadings(string text)
    {
        Assert.Equal("Maria Souza", ResumeParser.Parse(text).FullName);
    }

    [Fact]
    public void Parse_SkipsLinesWithEmailOrDigits()
    {
        var result = ResumeParser.Parse("maria@example.com\n(11) 98888-7777\nRua Augusta 100\nMaria Souza");

        Assert.Equal("Maria Souza", result.FullName);
    }

    [Fact]
    public void Parse_SplitsHeaderOnSeparators()
    {
        var result = ResumeParser.Parse("Maria Souza | maria@example.com | (11) 98888-7777\nDesenvolvedora Backend");

        Assert.Equal(new ParsedResume("Maria Souza", "maria@example.com", "(11) 98888-7777"), result);
    }

    [Theory]
    [InlineData("José Araújo")]
    [InlineData("Ana-Maria D'Ávila")]
    [InlineData("MARIA SOUZA")]
    [InlineData("Maria de Souza dos Santos")]
    public void Parse_AcceptsNameVariants(string name)
    {
        Assert.Equal(name, ResumeParser.Parse($"{name}\nmaria@example.com").FullName);
    }

    [Fact]
    public void Parse_CollapsesRepeatedSpacesInName()
    {
        Assert.Equal("Maria Souza", ResumeParser.Parse("   Maria     Souza   \nmaria@example.com").FullName);
    }

    [Theory]
    [InlineData("Maria")]
    [InlineData("Maria Souza Lima Costa Pereira Alves Rocha")]
    public void Parse_RejectsWordCountOutsideTwoToSix(string line)
    {
        Assert.Null(ResumeParser.Parse($"{line}\nmaria@example.com").FullName);
    }

    [Fact]
    public void Parse_IgnoresNameAfterFifthNonEmptyLine()
    {
        Assert.Null(ResumeParser.Parse("Objetivo\n2020\n2021\n2022\n2023\nMaria Souza").FullName);
    }

    [Fact]
    public void Parse_BlankLinesDoNotCountTowardsFirstFive()
    {
        Assert.Equal("Maria Souza", ResumeParser.Parse("\n\n\n\n\n\nMaria Souza").FullName);
    }

    [Fact]
    public void Parse_HandlesWindowsLineBreaks()
    {
        var result = ResumeParser.Parse("Maria Souza\r\nmaria@example.com\r\n(11) 98888-7777\r\n");

        Assert.Equal(new ParsedResume("Maria Souza", "maria@example.com", "(11) 98888-7777"), result);
    }

    [Fact]
    public void Parse_EmptyText_ReturnsAllNull()
    {
        Assert.Equal(new ParsedResume(null, null, null), ResumeParser.Parse(""));
    }
}
