use bevy::camera::ScalingMode;
use bevy::core_pipeline::tonemapping::Tonemapping;
use bevy::prelude::*;

const VIEWPORT_HEIGHT: f32 = 12.0;

#[derive(Component, Default)]
struct InteractivePrimitive {
    selected: bool,
}

#[derive(Resource)]
struct InteractionMaterials {
    idle: Handle<StandardMaterial>,
    selected: Handle<StandardMaterial>,
}

fn main() {
    App::new()
        .add_plugins((DefaultPlugins, MeshPickingPlugin))
        .insert_resource(MeshPickingSettings {
            require_markers: true,
            ..default()
        })
        .insert_resource(ClearColor(Color::srgb(0.53, 0.81, 0.92)))
        .add_systems(Startup, setup_scene)
        .run();
}

fn setup_scene(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
) {
    commands.spawn((
        Camera3d::default(),
        MeshPickingCamera,
        Tonemapping::None,
        Projection::from(OrthographicProjection {
            scaling_mode: ScalingMode::FixedVertical {
                viewport_height: VIEWPORT_HEIGHT,
            },
            ..OrthographicProjection::default_3d()
        }),
        Transform::from_xyz(10.0, 10.0, 14.0).looking_at(Vec3::ZERO, Vec3::Y),
    ));

    commands.spawn((
        DirectionalLight {
            illuminance: 8_000.0,
            shadow_maps_enabled: false,
            ..default()
        },
        Transform::from_xyz(6.0, 10.0, 8.0).looking_at(Vec3::ZERO, Vec3::Y),
    ));

    commands.spawn((
        Mesh3d(meshes.add(Cuboid::new(20.0, 0.2, 12.0))),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color: Color::srgb(0.32, 0.58, 0.30),
            unlit: true,
            ..default()
        })),
        Transform::from_xyz(0.0, -0.2, 0.0),
    ));

    commands.spawn((
        Mesh3d(meshes.add(Cuboid::new(16.0, 0.25, 4.5))),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color: Color::srgb(0.22, 0.24, 0.27),
            unlit: true,
            ..default()
        })),
        Transform::from_xyz(0.0, 0.0, 0.0),
    ));

    let road_marking_mesh = meshes.add(Cuboid::new(2.0, 0.04, 0.18));
    let road_marking_material = materials.add(StandardMaterial {
        base_color: Color::srgb(1.0, 0.82, 0.18),
        unlit: true,
        ..default()
    });
    for x in [-5.25, -1.75, 1.75, 5.25] {
        commands.spawn((
            Mesh3d(road_marking_mesh.clone()),
            MeshMaterial3d(road_marking_material.clone()),
            Transform::from_xyz(x, 0.15, 0.0),
        ));
    }

    let interaction_materials = InteractionMaterials {
        idle: materials.add(StandardMaterial {
            base_color: Color::srgb(0.12, 0.65, 1.0),
            unlit: true,
            ..default()
        }),
        selected: materials.add(StandardMaterial {
            base_color: Color::srgb(1.0, 0.34, 0.18),
            unlit: true,
            ..default()
        }),
    };

    commands
        .spawn((
            InteractivePrimitive::default(),
            Pickable::default(),
            Mesh3d(meshes.add(Capsule3d::new(0.8, 1.2))),
            MeshMaterial3d(interaction_materials.idle.clone()),
            Transform::from_xyz(0.0, 1.25, 0.0),
        ))
        .observe(on_primitive_clicked);

    commands.insert_resource(interaction_materials);
}

fn on_primitive_clicked(
    click: On<Pointer<Click>>,
    interaction_materials: Res<InteractionMaterials>,
    mut targets: Query<(
        &mut InteractivePrimitive,
        &mut MeshMaterial3d<StandardMaterial>,
    )>,
) {
    let Ok((mut target, mut material)) = targets.get_mut(click.entity) else {
        return;
    };

    target.selected = !target.selected;
    info!("Interactive primitive selected: {}", target.selected);
    material.0 = if target.selected {
        interaction_materials.selected.clone()
    } else {
        interaction_materials.idle.clone()
    };
}
