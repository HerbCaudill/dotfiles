using System;
using System.Reflection;
using System.Web.Hosting;

/** Compute the registered built provider inside the deployment's ASP.NET hosting context, without starting IIS. */
public sealed class DrenvSchemaProbe : MarshalByRefObject
{
    public override object InitializeLifetimeService() { return null; }
    public string Compute()
    {
        var web = Assembly.Load("DevResults");
        web.GetType("DevResults.LegacyInterop", true).GetMethod("Initialize", BindingFlags.Public | BindingFlags.Static).Invoke(null, null);
        var builder = web.GetType("DevResults.IOC.Builder", true).GetMethod("Create", BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static).Invoke(null, null);
        var api = Assembly.Load("DevResults.Api");
        foreach (var name in new[] { "DevResults.Api.Configurator", "DevResults.Api.SharedConfigurator" })
            api.GetType(name, true).GetMethod("RegisterDependencies", BindingFlags.Public | BindingFlags.Static).Invoke(null, new object[] { builder });
        // Reflection keeps the personal probe independent of the app's Autofac target framework version.
        var build = builder.GetType().GetMethod("Build");
        var buildParameters = build.GetParameters();
        var container = build.Invoke(builder, buildParameters.Length == 0 ? null : new object[] { Enum.ToObject(buildParameters[0].ParameterType, 0) });
        try
        {
            var autofac = Assembly.Load("Autofac");
            var providerType = Assembly.Load("DevResults.Core").GetType("DevResults.Deployment.IVersionStateProvider", true);
            foreach (var method in autofac.GetType("Autofac.ResolutionExtensions", true).GetMethods(BindingFlags.Public | BindingFlags.Static))
            {
                var parameters = method.GetParameters();
                if (method.Name != "Resolve" || method.ContainsGenericParameters || parameters.Length != 3 || parameters[1].ParameterType != typeof(Type) || !parameters[2].ParameterType.IsArray) continue;
                var empty = Array.CreateInstance(parameters[2].ParameterType.GetElementType(), 0);
                var provider = method.Invoke(null, new object[] { container, providerType, empty });
                return (string)providerType.GetMethod("Compute").Invoke(provider, null);
            }
            throw new InvalidOperationException("The built Autofac assembly has no supported typed Resolve overload");
        }
        finally { ((IDisposable)container).Dispose(); }
    }
    public void Shutdown() { HostingEnvironment.InitiateShutdown(); }
}
